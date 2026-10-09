import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { afterMock, processingEmail, fulfillmentWorker } = vi.hoisted(() => ({
  afterMock: vi.fn(),
  processingEmail: vi.fn(),
  fulfillmentWorker: vi.fn(),
}));
vi.mock("@/lib/email/order-emails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/email/order-emails")>()),
  sendOrderProcessingEmail: processingEmail,
}));
vi.mock("@/lib/scraper/order-fulfillment", () => ({
  processNextFulfillment: fulfillmentWorker,
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: afterMock,
}));

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
    jobs: [] as Array<Record<string, unknown>>,
    notifications: [] as Array<Record<string, unknown>>,
    failEmailQueue: false,
    failJob: false,
    failCreateMany: false,
    agentQueries: [] as Array<Record<string, unknown>>,
  };
  let seq = 0;

  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  function makeTx(undo: Array<() => void>) {
    return {
      agent: {
        findMany: async ({
          where,
          take,
        }: {
          where: { unlockedBy: { none: { userId: string } } };
          take: number;
        }) => {
          state.agentQueries.push({ where, take });
          await tick();
          const owned = new Set(
            state.unlocks
              .filter((u) => u.userId === where.unlockedBy.none.userId)
              .map((u) => u.agentId),
          );
          return state.agentIds
            .filter((id) => !owned.has(id))
            .slice(0, take)
            .map((id) => ({ id }));
        },
      },
      user: {
        updateMany: async ({
          where,
          data,
        }: {
          where: { credits: { gte: number } };
          data: { credits: { decrement: number } };
        }) => {
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
          undo.push(() =>
            state.purchases.splice(state.purchases.indexOf(row), 1),
          );
          return row;
        },
      },
      leadFulfillmentJob: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          if (state.failJob) throw new Error("outbox unavailable");
          state.jobs.push(data);
          undo.push(() => state.jobs.splice(state.jobs.indexOf(data), 1));
          return { id: `job_${seq}`, ...data };
        },
      },
      orderEmailNotification: {
        upsert: async ({ create }: { create: Record<string, unknown> }) => {
          if (state.failEmailQueue) throw new Error("email outbox unavailable");
          state.notifications.push(create);
          undo.push(() =>
            state.notifications.splice(state.notifications.indexOf(create), 1),
          );
          return { id: `email_${seq}`, ...create };
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
          const clash =
            state.failCreateMany ||
            data.some((d) =>
              state.unlocks.some(
                (u) => u.userId === d.userId && u.agentId === d.agentId,
              ),
            );
          if (clash) {
            throw new Prisma.PrismaClientKnownRequestError(
              "Unique constraint failed",
              { code: "P2002", clientVersion: "test" },
            );
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
    $transaction: vi.fn(
      async <T>(cb: (tx: ReturnType<typeof makeTx>) => Promise<T>) => {
        const undo: Array<() => void> = [];
        try {
          return await cb(makeTx(undo));
        } catch (err) {
          for (const fn of undo.reverse()) fn();
          throw err;
        }
      },
    ),
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
  afterMock.mockReset();
  processingEmail
    .mockReset()
    .mockResolvedValue({ success: true, status: "SENT" });
  fulfillmentWorker
    .mockReset()
    .mockResolvedValue({ worked: false, status: "IDLE" });
  state.notifications = [];
  state.failEmailQueue = false;
  vi.stubEnv("LOBSTR_PARALLEL_ENABLED", "false");
  vi.stubEnv("LOBSTR_API_KEY", "mock-only-key");
  vi.stubEnv("LOBSTR_FULFILLMENT_ENABLED", "true");
  state.credits = 10;
  state.agentIds = Array.from({ length: 50 }, (_, i) => `agent_${i}`);
  state.unlocks = [];
  state.purchases = [];
  state.ledger = [];
  state.jobs = [];
  state.failJob = false;
  state.failCreateMany = false;
  state.agentQueries = [];
  authMock.mockResolvedValue({ user: { id: "user_1" } });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/purchases/order", () => {
  it("rejects unauthenticated requests", async () => {
    authMock.mockResolvedValue(null);
    expect(
      (await POST(order({ tier: "PHONE_ONLY", states: ["CA"], quantity: 1 })))
        .status,
    ).toBe(401);
  });

  it("validates states and quantity", async () => {
    expect(
      (
        await POST(
          order({ tier: "PHONE_ONLY", states: ["CA", "ZZ"], quantity: 5 }),
        )
      ).status,
    ).toBe(400);
    expect(
      (await POST(order({ tier: "PHONE_ONLY", states: [], quantity: 5 })))
        .status,
    ).toBe(400);
    expect(
      (await POST(order({ tier: "PHONE_ONLY", states: ["CA"], quantity: 0 })))
        .status,
    ).toBe(400);
    expect(
      (await POST(order({ tier: "PHONE_ONLY", states: ["CA"], quantity: 1.5 })))
        .status,
    ).toBe(400);
  });

  it("deducts credits atomically and records the order", async () => {
    const res = await POST(
      order({ tier: "PHONE_ONLY", states: ["ca"], quantity: 10 }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      success: true,
      unlockedCount: 10,
      creditsDeducted: 10,
      remainingCredits: 0,
    });
    expect(state.credits).toBe(0);
    expect(state.unlocks).toHaveLength(10);
    expect(state.ledger[0]).toMatchObject({
      type: "PURCHASE",
      amount: -10,
      balanceAfter: 0,
    });
  });

  it("stores amountPaid as the USD value, not the lead count", async () => {
    await POST(order({ tier: "PHONE_ONLY", states: ["CA"], quantity: 10 }));
    const purchase = state.purchases[0] as {
      amountPaid: { toString(): string };
      leadCount: number;
      unlockedStates: string[];
    };
    expect(purchase.amountPaid.toString()).toBe("0.19");
    expect(purchase.leadCount).toBe(10);
    expect(purchase.unlockedStates).toEqual(["CA"]);
  });

  it("holds the full amount and queues shortages instead of partial delivery", async () => {
    state.agentIds = ["a1", "a2", "a3"];
    const res = await POST(
      order({ tier: "PHONE_ONLY", states: ["CA"], quantity: 10 }),
    );
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({
      status: "PROCESSING",
      unlockedCount: 0,
      creditsDeducted: 10,
      remainingCredits: 0,
    });
    expect(state.unlocks).toHaveLength(0);
    expect(afterMock).toHaveBeenCalledOnce();
    expect(state.jobs[0]).toMatchObject({
      creditsHeld: 10,
      runs: { create: [{ state: "CA", targetQuantity: 10 }] },
    });
  });

  it("returns 402 when credits are insufficient", async () => {
    state.credits = 4;
    const res = await POST(
      order({ tier: "PHONE_ONLY", states: ["CA"], quantity: 10 }),
    );
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({
      error: "INSUFFICIENT_CREDITS",
      required: 10,
      current: 4,
    });
    expect(state.credits).toBe(4);
  });

  it("queues an empty-inventory order with a full credit hold", async () => {
    state.agentIds = [];
    const res = await POST(
      order({ tier: "PHONE_ONLY", states: ["CA"], quantity: 5 }),
    );
    expect(res.status).toBe(202);
    expect(state.credits).toBe(5);
    expect(state.jobs).toHaveLength(1);
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
    const res = await POST(
      order({ tier: "PHONE_ONLY", states: ["CA"], quantity: 5 }),
    );
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
    expect(await response.json()).toMatchObject({
      tier: "VERIFIED_EMAIL",
      creditsDeducted: 20,
      remainingCredits: 0,
    });
    expect(state.purchases[0]).toMatchObject({ tier: "VERIFIED_EMAIL" });
    expect(state.ledger[0]).toMatchObject({
      amount: -20,
      metadata: { tier: "VERIFIED_EMAIL", creditsPerLead: 2, creditsSpent: 20 },
    });
    expect(
      (state.purchases[0].amountPaid as { toString(): string }).toString(),
    ).toBe("0.38");
    expect(state.agentQueries[0].where).toMatchObject({
      isDeliverable: true,
      emailStatus: { in: ["validated", "deliverable"] },
    });
  });

  it("persists phone tier and queries phone inventory without requiring email", async () => {
    const response = await POST(
      order({ tier: "PHONE_ONLY", states: ["CA"], quantity: 10 }),
    );
    expect(response.status).toBe(200);
    expect(state.purchases[0]).toMatchObject({ tier: "PHONE_ONLY" });
    expect(state.ledger[0]).toMatchObject({
      metadata: { tier: "PHONE_ONLY", creditsPerLead: 1 },
    });
    expect(state.agentQueries[0].where).toMatchObject({
      AND: [{ phone: { not: null } }, { phone: { not: "" } }],
    });
    expect(state.agentQueries[0].where).not.toHaveProperty("emailStatus");
  });

  it("rejects unknown and null tiers without charging", async () => {
    for (const tier of ["FREE", "phone_only", null]) {
      expect(
        (await POST(order({ tier, states: ["CA"], quantity: 5 }))).status,
      ).toBe(400);
    }
    expect(state.credits).toBe(10);
    expect(state.purchases).toHaveLength(0);
  });

  it("checks the requested tier cost before inventory selection", async () => {
    const response = await POST(
      order({ tier: "VERIFIED_EMAIL", states: ["CA"], quantity: 10 }),
    );
    expect(response.status).toBe(402);
    expect(await response.json()).toEqual({
      error: "INSUFFICIENT_CREDITS",
      required: 20,
      current: 10,
    });
    expect(state.agentQueries).toHaveLength(0);
  });

  it("holds two credits per requested verified lead while collecting the shortage", async () => {
    state.credits = 20;
    state.agentIds = ["a", "b", "c"];
    const response = await POST(
      order({ tier: "VERIFIED_EMAIL", states: ["CA"], quantity: 10 }),
    );
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      status: "PROCESSING",
      unlockedCount: 0,
      creditsDeducted: 20,
      remainingCredits: 0,
    });
    expect(state.jobs[0]).toMatchObject({ creditsHeld: 20 });
  });

  it("prevents two-credit double-spend under concurrent orders", async () => {
    state.credits = 20;
    const responses = await Promise.all([
      POST(order({ tier: "VERIFIED_EMAIL", states: ["CA"], quantity: 10 })),
      POST(order({ tier: "VERIFIED_EMAIL", states: ["CA"], quantity: 10 })),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 402,
    ]);
    expect(state.credits).toBe(0);
    expect(state.unlocks).toHaveLength(10);
    expect(state.purchases).toHaveLength(1);
  });

  it("rolls back the two-credit debit and tier metadata on unlock failure", async () => {
    state.credits = 20;
    state.failCreateMany = true;
    expect(
      (
        await POST(
          order({ tier: "VERIFIED_EMAIL", states: ["CA"], quantity: 10 }),
        )
      ).status,
    ).toBe(409);
    expect(state.credits).toBe(20);
    expect(state.purchases).toHaveLength(0);
    expect(state.ledger).toHaveLength(0);
  });
});

describe("durable fulfillment order safety", () => {
  it("returns COMPLETED and does not enqueue when enough fresh inventory exists", async () => {
    const response = await POST(
      order({ tier: "PHONE_ONLY", states: ["CA"], quantity: 5 }),
    );
    expect(await response.json()).toMatchObject({
      status: "COMPLETED",
      unlockedCount: 5,
    });
    expect(state.jobs).toHaveLength(0);
    expect(afterMock).not.toHaveBeenCalled();
    expect(state.agentQueries[0].where).toHaveProperty("OR");
  });
  it("does not debit when shortage fulfillment is disabled", async () => {
    vi.stubEnv("LOBSTR_FULFILLMENT_ENABLED", "false");
    state.agentIds = [];
    expect(
      (await POST(order({ tier: "PHONE_ONLY", states: ["CA"], quantity: 5 })))
        .status,
    ).toBe(503);
    expect(state.credits).toBe(10);
    expect(state.purchases).toHaveLength(0);
  });
  it("does not debit a shortage with no Lobstr API key", async () => {
    vi.stubEnv("LOBSTR_API_KEY", "");
    state.agentIds = [];
    expect(
      (await POST(order({ tier: "PHONE_ONLY", states: ["CA"], quantity: 5 })))
        .status,
    ).toBe(503);
    expect(state.credits).toBe(10);
  });
  it("rolls back the full debit, purchase and ledger if outbox creation fails", async () => {
    state.agentIds = [];
    state.failJob = true;
    expect(
      (await POST(order({ tier: "PHONE_ONLY", states: ["CA"], quantity: 5 })))
        .status,
    ).toBe(500);
    expect(state.credits).toBe(10);
    expect(state.purchases).toHaveLength(0);
    expect(state.ledger).toHaveLength(0);
  });
  it("holds credits once under concurrent shortage orders", async () => {
    state.agentIds = [];
    const responses = await Promise.all([
      POST(order({ tier: "PHONE_ONLY", states: ["CA"], quantity: 10 })),
      POST(order({ tier: "PHONE_ONLY", states: ["CA"], quantity: 10 })),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      202, 402,
    ]);
    expect(state.credits).toBe(0);
    expect(state.jobs).toHaveLength(1);
    expect(state.unlocks).toHaveLength(0);
  });
});

it("still acknowledges an accepted order if after registration fails", async () => {
  state.agentIds = [];
  afterMock.mockImplementationOnce(() => {
    throw new Error("missing request lifecycle");
  });
  const response = await POST(
    order({ tier: "PHONE_ONLY", states: ["CA"], quantity: 5 }),
  );
  expect(response.status).toBe(202);
  expect(state.jobs).toHaveLength(1);
  expect(state.credits).toBe(5);
});

describe("processing order email scheduling", () => {
  it("persists the event atomically and sends only through after()", async () => {
    state.agentIds = [];
    const response = await POST(
      order({ tier: "PHONE_ONLY", states: ["TX"], quantity: 2 }),
    );
    expect(response.status).toBe(202);
    expect(state.notifications).toEqual([
      { purchaseId: state.purchases[0]!.id, kind: "PROCESSING" },
    ]);
    expect(processingEmail).not.toHaveBeenCalled();
    const callback = afterMock.mock.calls[0]![0] as () => Promise<void>;
    await callback();
    expect(processingEmail).toHaveBeenCalledWith(state.purchases[0]!.id);
    expect(fulfillmentWorker).toHaveBeenCalledOnce();
  });
  it("does not notify instant inventory orders", async () => {
    expect(
      (await POST(order({ tier: "PHONE_ONLY", states: ["TX"], quantity: 2 })))
        .status,
    ).toBe(200);
    expect(state.notifications).toEqual([]);
    expect(processingEmail).not.toHaveBeenCalled();
  });
  it("rolls back the hold if the durable notification cannot be queued", async () => {
    state.agentIds = [];
    state.failEmailQueue = true;
    expect(
      (await POST(order({ tier: "PHONE_ONLY", states: ["TX"], quantity: 2 })))
        .status,
    ).toBe(500);
    expect(state.credits).toBe(10);
    expect(state.purchases).toEqual([]);
    expect(state.jobs).toEqual([]);
    expect(state.ledger).toEqual([]);
    expect(afterMock).not.toHaveBeenCalled();
  });
  it("still dispatches fulfillment if sending the email unexpectedly throws", async () => {
    state.agentIds = [];
    processingEmail.mockRejectedValue(new Error("provider down"));
    expect(
      (await POST(order({ tier: "PHONE_ONLY", states: ["TX"], quantity: 2 })))
        .status,
    ).toBe(202);
    await (afterMock.mock.calls[0]![0] as () => Promise<void>)();
    expect(fulfillmentWorker).toHaveBeenCalledOnce();
    expect(state.credits).toBe(8);
  });
});

describe("funded parallel order planning", () => {
  beforeEach(() => {
    vi.stubEnv("LOBSTR_PARALLEL_ENABLED", "true");
    vi.stubEnv("LOBSTR_ESTIMATED_CREDITS_PER_RESULT", "10");
    state.agentIds = [];
    state.credits = 20_000;
  });
  it("atomically holds credits and snapshots five geographic shards for 500 leads", async () => {
    const response = await POST(
      order({ states: ["GA"], quantity: 500, tier: "PHONE_ONLY" }),
    );
    expect(response.status).toBe(202);
    const job = state.jobs[0]! as {
      parallelConfig: { concurrency: number };
      runs: { create: Array<{ zipCode: string; targetQuantity: number }> };
    };
    expect(job.parallelConfig.concurrency).toBe(5);
    expect(job.runs.create).toHaveLength(5);
    expect(new Set(job.runs.create.map((run) => run.zipCode)).size).toBe(5);
    expect(
      job.runs.create.reduce((total, run) => total + run.targetQuantity, 0),
    ).toBe(500);
    expect(state.credits).toBe(19_500);
    expect(state.ledger).toHaveLength(1);
    expect(state.unlocks).toHaveLength(0);
  });
  it("does not debit when parallel cost estimation is missing", async () => {
    vi.stubEnv("LOBSTR_ESTIMATED_CREDITS_PER_RESULT", "");
    expect(
      (await POST(order({ states: ["GA"], quantity: 500, tier: "PHONE_ONLY" })))
        .status,
    ).toBe(503);
    expect(state.credits).toBe(20_000);
    expect(state.purchases).toEqual([]);
  });
  it("still fulfills sufficient inventory even if parallel configuration is absent", async () => {
    vi.stubEnv("LOBSTR_ESTIMATED_CREDITS_PER_RESULT", "");
    state.agentIds = Array.from({ length: 500 }, (_, index) => `a${index}`);
    expect(
      (await POST(order({ states: ["GA"], quantity: 500, tier: "PHONE_ONLY" })))
        .status,
    ).toBe(200);
    expect(state.jobs).toHaveLength(0);
    expect(state.unlocks).toHaveLength(500);
  });
});
