import { beforeEach, describe, expect, it, vi } from "vitest";

interface Unlock {
  userId: string;
  agentId: string;
  purchaseId: string;
}

/**
 * In-memory stand-in for Postgres that preserves the semantics the route relies on:
 * conditional UPDATE (credits >= n), unique (userId, agentId) and transaction rollback.
 */
const { state, db, authMock } = vi.hoisted(() => {
  const state = {
    credits: 0,
    agentIds: [] as string[],
    unlocks: [] as Unlock[],
    purchases: [] as Array<Record<string, unknown>>,
    ledger: [] as Array<Record<string, unknown>>,
    failCreateMany: false,
    agentQueries: [] as Array<Record<string, unknown>>,
  };
  let seq = 0;

  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  function makeTx(undo: Array<() => void>) {
    return {
      agent: {
        findMany: async ({ where, take }: { where: { unlockedBy: { none: { userId: string } } }; take: number }) => {
          state.agentQueries.push({ where, take });
          await tick();
          const owned = new Set(state.unlocks.filter((u) => u.userId === where.unlockedBy.none.userId).map((u) => u.agentId));
          return state.agentIds.filter((id) => !owned.has(id)).slice(0, take).map((id) => ({ id }));
        },
      },
      user: {
        updateMany: async ({ where, data }: { where: { credits: { gte: number } }; data: { credits: { decrement: number } } }) => {
          await tick();
          if (state.credits < where.credits.gte) return { count: 0 };
          state.credits -= data.credits.decrement;
          undo.push(() => {
            state.credits += data.credits.decrement;
          });
          return { count: 1 };
        },
        findUnique: async () => ({ credits: state.credits }),
        findUniqueOrThrow: async () => ({ credits: state.credits }),
      },
      leadPurchase: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const row = { id: `p_${++seq}`, ...data };
          state.purchases.push(row);
          undo.push(() => state.purchases.splice(state.purchases.indexOf(row), 1));
          return row;
        },
      },
      walletTransaction: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          state.ledger.push(data);
          undo.push(() => state.ledger.splice(state.ledger.indexOf(data), 1));
          return data;
        },
      },
      unlockedLead: {
        createMany: async ({ data }: { data: Unlock[] }) => {
          await tick();
          const { Prisma } = await import("@fine-leads/database");
          const clash = state.failCreateMany || data.some((d) => state.unlocks.some((u) => u.userId === d.userId && u.agentId === d.agentId));
          if (clash) {
            throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" });
          }
          state.unlocks.push(...data);
          undo.push(() => {
            state.unlocks = state.unlocks.filter((u) => !data.includes(u));
          });
          return { count: data.length };
        },
      },
    };
  }

  const db = {
    user: { findUnique: vi.fn(async () => ({ credits: state.credits })) },
    $transaction: vi.fn(async <T,>(cb: (tx: ReturnType<typeof makeTx>) => Promise<T>) => {
      const undo: Array<() => void> = [];
      try {
        return await cb(makeTx(undo));
      } catch (err) {
        for (const fn of undo.reverse()) fn();
        throw err;
      }
    }),
  };

  return { state, db, authMock: vi.fn() };
});

vi.mock("@fine-leads/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fine-leads/database")>();
  return { ...actual, db };
});
vi.mock("@fine-leads/auth", () => ({ auth: authMock }));

import { POST } from "../app/api/purchases/order/route";

function order(body: unknown): Request {
  return new Request("https://app.test/api/purchases/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  state.credits = 10;
  state.agentIds = Array.from({ length: 50 }, (_, i) => `agent_${i}`);
  state.unlocks = [];
  state.purchases = [];
  state.ledger = [];
  state.failCreateMany = false;
  state.agentQueries = [];
  authMock.mockResolvedValue({ user: { id: "user_1" } });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("POST /api/purchases/order", () => {
  it("rejects unauthenticated requests", async () => {
    authMock.mockResolvedValue(null);
    expect((await POST(order({ tier: "PHONE_ONLY", states: ["CA"], quantity: 1 }))).status).toBe(401);
  });

  it("validates states and quantity", async () => {
    expect((await POST(order({ tier: "PHONE_ONLY", states: ["CA", "ZZ"], quantity: 5 }))).status).toBe(400);
    expect((await POST(order({ tier: "PHONE_ONLY", states: [], quantity: 5 }))).status).toBe(400);
    expect((await POST(order({ tier: "PHONE_ONLY", states: ["CA"], quantity: 0 }))).status).toBe(400);
    expect((await POST(order({ tier: "PHONE_ONLY", states: ["CA"], quantity: 1.5 }))).status).toBe(400);
  });

  it("deducts credits atomically and records the order", async () => {
    const res = await POST(order({ tier: "PHONE_ONLY", states: ["ca"], quantity: 10 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, unlockedCount: 10, creditsDeducted: 10, remainingCredits: 0 });
    expect(state.credits).toBe(0);
    expect(state.unlocks).toHaveLength(10);
    expect(state.ledger[0]).toMatchObject({ type: "PURCHASE", amount: -10, balanceAfter: 0 });
  });

  it("stores amountPaid as the USD value, not the lead count", async () => {
    await POST(order({ tier: "PHONE_ONLY", states: ["CA"], quantity: 10 }));
    const purchase = state.purchases[0] as { amountPaid: { toString(): string }; leadCount: number; unlockedStates: string[] };
    expect(purchase.amountPaid.toString()).toBe("0.19");
    expect(purchase.leadCount).toBe(10);
    expect(purchase.unlockedStates).toEqual(["CA"]);
  });

  it("only charges for leads actually available", async () => {
    state.agentIds = ["a1", "a2", "a3"];
    const res = await POST(order({ tier: "PHONE_ONLY", states: ["CA"], quantity: 10 }));
    expect(await res.json()).toMatchObject({ unlockedCount: 3, creditsDeducted: 3, remainingCredits: 7 });
  });

  it("returns 402 when credits are insufficient", async () => {
    state.credits = 4;
    const res = await POST(order({ tier: "PHONE_ONLY", states: ["CA"], quantity: 10 }));
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ error: "INSUFFICIENT_CREDITS", required: 10, current: 4 });
    expect(state.credits).toBe(4);
  });

  it("returns 400 and charges nothing when no leads are available", async () => {
    state.agentIds = [];
    const res = await POST(order({ tier: "PHONE_ONLY", states: ["CA"], quantity: 5 }));
    expect(res.status).toBe(400);
    expect(state.credits).toBe(10);
  });

  it("prevents double-spend under concurrent orders", async () => {
    const [a, b] = await Promise.all([
      POST(order({ tier: "PHONE_ONLY", states: ["CA"], quantity: 10 })),
      POST(order({ tier: "PHONE_ONLY", states: ["CA"], quantity: 10 })),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 402]);
    expect(state.credits).toBe(0);
    expect(state.unlocks).toHaveLength(10);
    expect(state.purchases).toHaveLength(1);
  });

  it("rolls back the debit when unlocking fails (unique conflict)", async () => {
    state.failCreateMany = true;
    const res = await POST(order({ tier: "PHONE_ONLY", states: ["CA"], quantity: 5 }));
    expect(res.status).toBe(409);
    expect(state.credits).toBe(10);
    expect(state.purchases).toHaveLength(0);
    expect(state.ledger).toHaveLength(0);
  });
});

describe("tier-aware order charging", () => {
  it("defaults omitted tier to verified email at two credits per lead", async () => {
    state.credits = 20;
    const response = await POST(order({ states: ["CA"], quantity: 10 }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ tier: "VERIFIED_EMAIL", creditsDeducted: 20, remainingCredits: 0 });
    expect(state.purchases[0]).toMatchObject({ tier: "VERIFIED_EMAIL" });
    expect(state.ledger[0]).toMatchObject({ amount: -20, metadata: { tier: "VERIFIED_EMAIL", creditsPerLead: 2, creditsSpent: 20 } });
    expect((state.purchases[0].amountPaid as { toString(): string }).toString()).toBe("0.38");
    expect(state.agentQueries[0].where).toMatchObject({ isDeliverable: true, emailStatus: { in: ["validated", "deliverable"] } });
  });

  it("persists phone tier and queries phone inventory without requiring email", async () => {
    const response = await POST(order({ tier: "PHONE_ONLY", states: ["CA"], quantity: 10 }));
    expect(response.status).toBe(200);
    expect(state.purchases[0]).toMatchObject({ tier: "PHONE_ONLY" });
    expect(state.ledger[0]).toMatchObject({ metadata: { tier: "PHONE_ONLY", creditsPerLead: 1 } });
    expect(state.agentQueries[0].where).toMatchObject({ AND: [{ phone: { not: null } }, { phone: { not: "" } }] });
    expect(state.agentQueries[0].where).not.toHaveProperty("emailStatus");
  });

  it("rejects unknown and null tiers without charging", async () => {
    for (const tier of ["FREE", "phone_only", null]) {
      expect((await POST(order({ tier, states: ["CA"], quantity: 5 }))).status).toBe(400);
    }
    expect(state.credits).toBe(10);
    expect(state.purchases).toHaveLength(0);
  });

  it("checks the requested tier cost before inventory selection", async () => {
    const response = await POST(order({ tier: "VERIFIED_EMAIL", states: ["CA"], quantity: 10 }));
    expect(response.status).toBe(402);
    expect(await response.json()).toEqual({ error: "INSUFFICIENT_CREDITS", required: 20, current: 10 });
    expect(state.agentQueries).toHaveLength(0);
  });

  it("charges two credits only for verified leads actually allocated", async () => {
    state.credits = 20;
    state.agentIds = ["a", "b", "c"];
    const response = await POST(order({ tier: "VERIFIED_EMAIL", states: ["CA"], quantity: 10 }));
    expect(await response.json()).toMatchObject({ unlockedCount: 3, creditsDeducted: 6, remainingCredits: 14 });
  });

  it("prevents two-credit double-spend under concurrent orders", async () => {
    state.credits = 20;
    const responses = await Promise.all([
      POST(order({ tier: "VERIFIED_EMAIL", states: ["CA"], quantity: 10 })),
      POST(order({ tier: "VERIFIED_EMAIL", states: ["CA"], quantity: 10 })),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 402]);
    expect(state.credits).toBe(0);
    expect(state.unlocks).toHaveLength(10);
    expect(state.purchases).toHaveLength(1);
  });

  it("rolls back the two-credit debit and tier metadata on unlock failure", async () => {
    state.credits = 20;
    state.failCreateMany = true;
    expect((await POST(order({ tier: "VERIFIED_EMAIL", states: ["CA"], quantity: 10 }))).status).toBe(409);
    expect(state.credits).toBe(20);
    expect(state.purchases).toHaveLength(0);
    expect(state.ledger).toHaveLength(0);
  });
});
