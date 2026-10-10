import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { db, state, afterMock } = vi.hoisted(() => ({
  state: {
    credits: 0,
    events: new Map<string, any>(),
    ledger: [] as any[],
    purchases: [] as any[],
    unlocks: [] as any[],
    jobs: [] as any[],
    agents: [] as any[],
    log: [] as string[],
    tails: new Map<string, Promise<void>>(),
  },
  afterMock: vi.fn(),
  db: {
    $transaction: vi.fn(),
    webhookEvent: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    user: { findUnique: vi.fn(), update: vi.fn() },
    walletTransaction: {
      create: vi.fn(),
      findFirst: vi.fn(),
      aggregate: vi.fn(),
      update: vi.fn(),
    },
    agent: { findMany: vi.fn() },
    leadPurchase: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    unlockedLead: { createMany: vi.fn(), deleteMany: vi.fn() },
    leadFulfillmentJob: { create: vi.fn(), updateMany: vi.fn() },
    orderEmailNotification: { upsert: vi.fn(), updateMany: vi.fn() },
  },
}));
vi.mock("@fine-leads/database", async (original) => ({
  ...(await original<typeof import("@fine-leads/database")>()),
  db,
}));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: afterMock,
}));
vi.mock("@/lib/scraper/order-fulfillment", () => ({
  processNextFulfillment: vi.fn(),
}));
vi.mock("@/lib/email/order-emails", async (original) => ({
  ...(await original<typeof import("@/lib/email/order-emails")>()),
  sendOrderProcessingEmail: vi.fn(),
}));
import { POST } from "../app/api/lemon-squeezy/webhook/route";
import { buildCheckoutCustomData, priceOrder } from "@/lib/payments";
function payload(
  event = "order_created",
  refunded = 0,
  custom = buildCheckoutCustomData(
    "user",
    priceOrder({ type: "WALLET_TOPUP", tierId: "tier_1k" }),
  ),
  total = 2500,
) {
  return {
    meta: { event_name: event, custom_data: custom },
    data: {
      id: "42",
      type: "orders",
      attributes: {
        store_id: 123,
        currency: "USD",
        status:
          refunded >= total
            ? "refunded"
            : event === "order_created"
              ? "paid"
              : "partial_refund",
        subtotal: total,
        total,
        refunded_amount: refunded,
      },
    },
  };
}
async function deliver(body: ReturnType<typeof payload>) {
  const raw = JSON.stringify(body);
  return POST(
    new NextRequest("https://app.test/api/lemon-squeezy/webhook", {
      method: "POST",
      body: raw,
      headers: {
        "x-signature": crypto
          .createHmac("sha256", process.env.LEMONSQUEEZY_WEBHOOK_SECRET!)
          .update(raw)
          .digest("hex"),
      },
    }),
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  state.credits = 0;
  state.events.clear();
  state.ledger = [];
  state.purchases = [];
  state.unlocks = [];
  state.jobs = [];
  state.agents = Array.from({ length: 100 }, (_, i) => ({ id: `a${i}` }));
  state.log = [];
  state.tails.clear();
  delete process.env.LOBSTR_FULFILLMENT_ENABLED;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  db.$transaction.mockImplementation(async (cb) => {
    let release: (() => void) | undefined;
    let snapshot: any;
    const tx = {
      ...db,
      $queryRaw: vi.fn(async (_sql: TemplateStringsArray, key: string) => {
        state.log.push(`lock:${key}`);
        const previous = state.tails.get(key) ?? Promise.resolve();
        const current = new Promise<void>((resolve) => {
          release = resolve;
        });
        state.tails.set(
          key,
          previous.then(() => current),
        );
        await previous;
        snapshot = structuredClone({
          credits: state.credits,
          events: state.events,
          ledger: state.ledger,
          purchases: state.purchases,
          unlocks: state.unlocks,
          jobs: state.jobs,
        });
        return [];
      }),
    };
    try {
      return await cb(tx);
    } catch (error) {
      if (snapshot) Object.assign(state, snapshot);
      throw error;
    } finally {
      release?.();
    }
  });
  db.webhookEvent.findUnique.mockImplementation(async ({ where }) => {
    state.log.push("event-read");
    return state.events.get(where.eventId) ?? null;
  });
  db.webhookEvent.findMany.mockImplementation(async ({ where }) =>
    [...state.events.values()].filter(
      (e) =>
        e.eventId.startsWith(where.eventId.startsWith) &&
        where.status.in.includes(e.status),
    ),
  );
  db.webhookEvent.upsert.mockImplementation(
    async ({ where, create, update }) => {
      const row = state.events.has(where.eventId)
        ? { ...state.events.get(where.eventId), ...update }
        : { ...create };
      state.events.set(where.eventId, row);
      return row;
    },
  );
  db.webhookEvent.update.mockImplementation(async ({ where, data }) => {
    const row = { ...state.events.get(where.eventId), ...data };
    state.events.set(where.eventId, row);
    return row;
  });
  db.webhookEvent.updateMany.mockImplementation(async ({ where, data }) => {
    const row = state.events.get(where.eventId);
    if (!row || !where.status.in.includes(row.status)) return { count: 0 };
    Object.assign(row, data);
    return { count: 1 };
  });
  db.user.findUnique.mockResolvedValue({ id: "user" });
  db.user.update.mockImplementation(async ({ data }) => {
    state.credits +=
      (data.credits.increment ?? 0) - (data.credits.decrement ?? 0);
    return { credits: state.credits };
  });
  db.walletTransaction.create.mockImplementation(async ({ data }) => {
    const row = { ...data, id: `t${state.ledger.length}` };
    state.ledger.push(row);
    return row;
  });
  db.walletTransaction.findFirst.mockImplementation(
    async ({ where }) =>
      state.ledger.find((e) =>
        where.referenceId
          ? e.referenceId === where.referenceId
          : e.type === "RECHARGE",
      ) ?? null,
  );
  db.walletTransaction.aggregate.mockImplementation(async ({ where }) => ({
    _sum: {
      amount: state.ledger
        .filter(
          (e) =>
            e.type === "ADJUSTMENT" &&
            e.metadata.lsOrderId === where.metadata.equals,
        )
        .reduce((sum, e) => sum + e.amount, 0),
    },
  }));
  db.walletTransaction.update.mockResolvedValue({});
  db.agent.findMany.mockImplementation(async ({ take }) =>
    state.agents.slice(0, take),
  );
  db.leadPurchase.create.mockImplementation(async ({ data }) => {
    const row = {
      ...data,
      amountPaid: String(data.amountPaid),
      id: `p${state.purchases.length}`,
    };
    state.purchases.push(row);
    return row;
  });
  db.leadPurchase.findUnique.mockImplementation(
    async ({ where }) =>
      state.purchases.find((p) => p.referenceId === where.referenceId) ?? null,
  );
  db.leadPurchase.updateMany.mockImplementation(async ({ where, data }) => {
    const row = state.purchases.find(
      (p) => p.id === where.id && where.status.in.includes(p.status),
    );
    if (!row) return { count: 0 };
    Object.assign(row, data);
    return { count: 1 };
  });
  db.unlockedLead.createMany.mockImplementation(async ({ data }) => {
    state.unlocks.push(...data);
    return { count: data.length };
  });
  db.unlockedLead.deleteMany.mockImplementation(async ({ where }) => {
    state.unlocks = state.unlocks.filter(
      (u) => u.purchaseId !== where.purchaseId,
    );
    return { count: 1 };
  });
  db.leadFulfillmentJob.create.mockImplementation(async ({ data }) => {
    state.jobs.push(data);
    return { id: "j1" };
  });
  db.leadFulfillmentJob.updateMany.mockResolvedValue({ count: 1 });
  db.orderEmailNotification.upsert.mockResolvedValue({ id: "email" });
});
describe("P0 webhook financial invariants (transaction/lock model)", () => {
  it("acquires the order lock before event/ledger reads", async () => {
    await deliver(payload());
    expect(state.log[0]).toBe("lock:lemonsqueezy:order:42");
  });
  it("persists early refund and reconciles inside the paid transaction", async () => {
    expect((await deliver(payload("order_refunded", 1250))).status).toBe(200);
    expect(state.events.get("ls:order_refunded:42:1250").status).toBe(
      "pending",
    );
    expect(state.credits).toBe(0);
    await deliver(payload());
    expect(state.credits).toBe(500);
    expect(state.events.get("ls:order_refunded:42:1250").status).toBe(
      "processed",
    );
  });
  it("simultaneous created/refund delivery has the same net balance", async () => {
    await Promise.all([
      deliver(payload("order_refunded", 1250)),
      deliver(payload()),
    ]);
    expect(state.credits).toBe(500);
    expect(state.ledger.filter((x) => x.type === "RECHARGE")).toHaveLength(1);
  });
  it("simultaneous different cumulative refunds never overlap their deltas", async () => {
    await deliver(payload());
    await Promise.all([
      deliver(payload("order_refunded", 625)),
      deliver(payload("order_refunded", 1250)),
    ]);
    expect(state.credits).toBe(500);
    expect(
      state.ledger
        .filter((e) => e.type === "ADJUSTMENT")
        .reduce((n, e) => n - e.amount, 0),
    ).toBe(500);
  });
  it("reversed cumulative refunds are monotonic and duplicate deliveries are harmless", async () => {
    await deliver(payload());
    await deliver(payload("order_refunded", 1250));
    await deliver(payload("order_refunded", 625));
    await Promise.all([
      deliver(payload("order_refunded", 1250)),
      deliver(payload()),
    ]);
    expect(state.credits).toBe(500);
    expect(state.ledger.filter((e) => e.type === "RECHARGE")).toHaveLength(1);
  });
  it("multiple early refunds reconcile to the maximum cumulative amount", async () => {
    await deliver(payload("order_refunded", 1250));
    await deliver(payload("order_refunded", 625));
    await deliver(payload());
    expect(state.credits).toBe(500);
  });
  it("heals previously ignored early refunds on a duplicate paid event", async () => {
    await deliver(payload());
    state.events.set("ls:order_refunded:42:2500", {
      eventId: "ls:order_refunded:42:2500",
      status: "ignored",
      payload: payload("order_refunded", 2500),
    });
    await deliver(payload());
    expect(state.credits).toBe(0);
  });
  it("uses exact integer cents rather than floating-point floor", async () => {
    const custom = buildCheckoutCustomData(
      "user",
      priceOrder({ type: "WALLET_TOPUP", tierId: "tier_10k" }),
    );
    await deliver(payload("order_created", 0, custom, 16900));
    await deliver(payload("order_refunded", 9633, custom, 16900));
    expect(state.credits).toBe(4300);
  });
  it.each(["PHONE_ONLY", "VERIFIED_EMAIL"] as const)(
    "card %s allocates only the bought quantity and exact tier",
    async (tier) => {
      state.agents = Array.from({ length: 300 }, (_, i) => ({ id: `a${i}` }));
      const order = priceOrder({
        type: "LEAD_PURCHASE",
        states: ["CA"],
        quantity: 100,
        tier,
      });
      expect(
        (
          await deliver(
            payload(
              "order_created",
              0,
              buildCheckoutCustomData("user", order),
              order.amountCents,
            ),
          )
        ).status,
      ).toBe(200);
      expect(state.purchases[0]).toMatchObject({
        tier,
        leadCount: 100,
        status: "COMPLETED",
      });
      expect(state.unlocks).toHaveLength(100);
      expect(state.credits).toBe(0);
      expect(state.ledger).toHaveLength(0);
    },
  );
  it("full refund before card creation grants no data or cloud work", async () => {
    state.agents = [];
    const order = priceOrder({
      type: "LEAD_PURCHASE",
      states: ["CA"],
      quantity: 100,
    });
    const custom = buildCheckoutCustomData("user", order);
    const response = await deliver(
      payload("order_refunded", order.amountCents, custom, order.amountCents),
    );
    expect(response.status).toBe(200);
    await deliver(payload("order_created", 0, custom, order.amountCents));
    expect(state.purchases[0].status).toBe("REFUNDED");
    expect(state.unlocks).toHaveLength(0);
    expect(state.jobs).toHaveLength(0);
  });
  it("card shortages create the canonical durable job without debiting wallet credits", async () => {
    process.env.LOBSTR_FULFILLMENT_ENABLED = "true";
    process.env.LOBSTR_API_KEY = "test-only";
    state.agents = [];
    const order = priceOrder({
      type: "LEAD_PURCHASE",
      states: ["CA"],
      quantity: 100,
      tier: "PHONE_ONLY",
    });
    await deliver(
      payload(
        "order_created",
        0,
        buildCheckoutCustomData("user", order),
        order.amountCents,
      ),
    );
    expect(state.purchases[0]).toMatchObject({
      tier: "PHONE_ONLY",
      status: "PROCESSING",
    });
    expect(state.jobs[0].creditsHeld).toBe(0);
    expect(state.unlocks).toHaveLength(0);
    expect(afterMock).toHaveBeenCalledTimes(1);
    delete process.env.LOBSTR_API_KEY;
  });
  it("full card refund revokes allocations and cancels pending jobs", async () => {
    const order = priceOrder({
      type: "LEAD_PURCHASE",
      states: ["CA"],
      quantity: 100,
    });
    const custom = buildCheckoutCustomData("user", order);
    await deliver(payload("order_created", 0, custom, order.amountCents));
    const response = await deliver(
      payload("order_refunded", order.amountCents, custom, order.amountCents),
    );
    expect(response.status).toBe(200);
    expect(state.unlocks).toHaveLength(0);
    expect(state.purchases[0].status).toBe("REFUNDED");
    expect(db.leadFulfillmentJob.updateMany).toHaveBeenCalled();
  });
});
