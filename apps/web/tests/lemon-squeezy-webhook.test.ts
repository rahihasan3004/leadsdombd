import crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { db } = vi.hoisted(() => {
  const db = {
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
    unlockedLead: { createMany: vi.fn(), deleteMany: vi.fn() },
    leadFulfillmentJob: { updateMany: vi.fn(), create: vi.fn() },
    orderEmailNotification: { updateMany: vi.fn(), upsert: vi.fn() },
    $queryRaw: vi.fn(),
    leadPurchase: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return { db };
});

vi.mock("@fine-leads/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fine-leads/database")>();
  return { ...actual, db };
});

import { Prisma } from "@fine-leads/database";
import { POST } from "../app/api/lemon-squeezy/webhook/route";
import { buildCheckoutCustomData, priceOrder } from "@/lib/payments";

const SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET as string;
const topup = priceOrder({ type: "WALLET_TOPUP", tierId: "tier_500" }); // 500 credits, $15

function payload(
  opts: {
    event?: string;
    custom?: Record<string, string>;
    attrs?: Record<string, unknown>;
  } = {},
) {
  return {
    meta: {
      event_name: opts.event ?? "order_created",
      custom_data: opts.custom ?? buildCheckoutCustomData("user_1", topup),
    },
    data: {
      id: "1001",
      type: "orders",
      attributes: {
        store_id: 123,
        user_email: "u@test.dev",
        currency: "USD",
        status: "paid",
        refunded: false,
        subtotal: 1500,
        discount_total: 0,
        total: 1500,
        refunded_amount: 0,
        updated_at: "2026-01-01T00:00:00.000Z",
        ...opts.attrs,
      },
    },
  };
}

function signedRequest(body: unknown, signature?: string): NextRequest {
  const raw = JSON.stringify(body);
  const sig =
    signature ?? crypto.createHmac("sha256", SECRET).update(raw).digest("hex");
  return new NextRequest("https://app.test/api/lemon-squeezy/webhook", {
    method: "POST",
    headers: { "x-signature": sig },
    body: raw,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.LEMONSQUEEZY_WEBHOOK_SECRET = SECRET;
  db.$transaction.mockImplementation(async (cb: (tx: typeof db) => unknown) =>
    cb(db),
  );
  db.webhookEvent.findUnique.mockResolvedValue(null);
  db.webhookEvent.findMany.mockResolvedValue([]);
  db.walletTransaction.findFirst.mockResolvedValue(null);
  db.leadPurchase.findUnique.mockResolvedValue(null);
  db.leadPurchase.create.mockResolvedValue({ id: "lp_db_1" });
  db.agent.findMany.mockResolvedValue(
    Array.from({ length: 1000 }, (_, i) => ({ id: `a${i}` })),
  );
  db.$queryRaw.mockResolvedValue([]);
  db.user.findUnique.mockResolvedValue({ id: "user_1" });
  db.user.update.mockResolvedValue({ credits: 500 });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

describe("signature verification", () => {
  it("returns 500 when the secret is not configured (no fallback)", async () => {
    const body = payload();
    delete process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    const res = await POST(signedRequest(body, "ab".repeat(32)));
    expect(res.status).toBe(500);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("rejects invalid, missing and old-fallback signatures", async () => {
    const body = payload();
    const oldFallback = crypto
      .createHmac("sha256", "leadsdom_webhook_secret_2026")
      .update(JSON.stringify(body))
      .digest("hex");
    for (const sig of ["", "zz", "ab".repeat(32), oldFallback]) {
      expect((await POST(signedRequest(body, sig))).status).toBe(401);
    }
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("order_created", () => {
  it("credits exactly the signed tier's credits", async () => {
    const res = await POST(signedRequest(payload()));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "processed" });
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user_1" },
        data: { credits: { increment: 500 } },
      }),
    );
    expect(db.walletTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          referenceId: "ls_order_1001",
          amount: 500,
        }),
      }),
    );
    expect(db.webhookEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId: "ls:order_created:1001" } }),
    );
  });

  it("rejects a tampered tier (signature mismatch) without crediting", async () => {
    const custom = {
      ...buildCheckoutCustomData("user_1", topup),
      tier_id: "tier_50k",
      credits: "50000",
    };
    const res = await POST(signedRequest(payload({ custom })));
    expect(await res.json()).toMatchObject({ status: "rejected" });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("rejects underpayment (e.g. $1 paid for a $15 tier)", async () => {
    const res = await POST(
      signedRequest(payload({ attrs: { subtotal: 100, total: 100 } })),
    );
    expect(await res.json()).toMatchObject({ status: "rejected" });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("treats discounts as underpayment", async () => {
    const res = await POST(
      signedRequest(payload({ attrs: { discount_total: 500 } })),
    );
    expect(await res.json()).toMatchObject({ status: "rejected" });
  });

  it("ignores unpaid orders", async () => {
    const res = await POST(
      signedRequest(payload({ attrs: { status: "pending" } })),
    );
    expect(await res.json()).toMatchObject({ status: "ignored" });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("rejects orders from another store", async () => {
    const res = await POST(
      signedRequest(payload({ attrs: { store_id: 999 } })),
    );
    expect(res.status).toBe(200);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("skips already-processed events", async () => {
    db.webhookEvent.findUnique.mockResolvedValue({ status: "processed" });
    const res = await POST(signedRequest(payload()));
    expect(await res.json()).toMatchObject({ duplicate: true });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("does not swallow an allocation unique conflict as a processed payment", async () => {
    db.user.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    const res = await POST(signedRequest(payload()));
    expect(res.status).toBe(500);
    expect(await res.json()).not.toHaveProperty("duplicate");
  });

  it("returns a retryable error when the user no longer exists", async () => {
    db.user.findUnique.mockResolvedValue(null);
    const res = await POST(signedRequest(payload()));
    expect(res.status).toBe(422);
    expect(db.webhookEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: "failed" }),
      }),
    );
  });

  it("creates a lead purchase with server-validated states and quantity", async () => {
    const lead = priceOrder({
      type: "LEAD_PURCHASE",
      states: ["CA", "TX"],
      quantity: 1000,
    });
    const res = await POST(
      signedRequest(
        payload({
          custom: buildCheckoutCustomData("user_1", lead),
          attrs: { subtotal: 1900, total: 1900 },
        }),
      ),
    );
    expect(await res.json()).toMatchObject({ status: "processed" });
    expect(db.leadPurchase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user_1",
        unlockedStates: ["CA", "TX"],
        leadCount: 1000,
        referenceId: "lp_1001",
        status: "COMPLETED",
        tier: "VERIFIED_EMAIL",
      }),
    });
    expect(db.user.update).not.toHaveBeenCalled();
  });
});

describe("order_refunded", () => {
  beforeEach(() => {
    db.leadPurchase.findUnique.mockResolvedValue(null);
    db.walletTransaction.findFirst.mockResolvedValue({
      id: "wt_1",
      userId: "user_1",
      amount: 500,
    });
    db.walletTransaction.aggregate.mockResolvedValue({
      _sum: { amount: null },
    });
    db.user.update.mockResolvedValue({ credits: 0 });
  });

  it("reverses all credits on a full refund and marks the top-up refunded", async () => {
    const res = await POST(
      signedRequest(
        payload({
          event: "order_refunded",
          attrs: { status: "refunded", refunded: true, refunded_amount: 1500 },
        }),
      ),
    );
    expect(await res.json()).toMatchObject({ status: "processed" });
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { credits: { decrement: 500 } } }),
    );
    expect(db.walletTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "ADJUSTMENT",
        amount: -500,
        referenceId: "ls_refund_1001_1500",
      }),
    });
    expect(db.walletTransaction.update).toHaveBeenCalledWith({
      where: { id: "wt_1" },
      data: { status: "REFUNDED" },
    });
  });

  it("reverses credits proportionally on partial refunds, net of prior reversals", async () => {
    db.walletTransaction.aggregate.mockResolvedValue({
      _sum: { amount: -100 },
    });
    await POST(
      signedRequest(
        payload({
          event: "order_refunded",
          attrs: { status: "partial_refund", refunded_amount: 750 },
        }),
      ),
    );
    // 50% of 500 = 250, minus 100 already reversed.
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { credits: { decrement: 150 } } }),
    );
    expect(db.walletTransaction.update).not.toHaveBeenCalled();
  });

  it("revokes a card-paid lead purchase on full refund", async () => {
    db.leadPurchase.findUnique.mockResolvedValue({
      id: "lp_db_1",
      status: "COMPLETED",
    });
    await POST(
      signedRequest(
        payload({
          event: "order_refunded",
          attrs: { status: "refunded", refunded_amount: 1500 },
        }),
      ),
    );
    expect(db.leadPurchase.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "lp_db_1",
          status: { in: ["COMPLETED", "PROCESSING", "FAILED", "PENDING"] },
        },
        data: expect.objectContaining({ status: "REFUNDED" }),
      }),
    );
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("uses a refund-amount-specific idempotency key", async () => {
    await POST(
      signedRequest(
        payload({
          event: "order_refunded",
          attrs: { status: "partial_refund", refunded_amount: 300 },
        }),
      ),
    );
    expect(db.webhookEvent.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: "ls:order_refunded:1001:300" },
      }),
    );
  });
});

describe("resilient order_created transactions", () => {
  it("uses the signed user ID first without looking up a different email", async () => {
    await POST(signedRequest(payload()));
    expect(db.user.findUnique).toHaveBeenCalledTimes(1);
    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user_1" },
      select: { id: true },
    });
  });

  it("resolves a missing signed checkout user by the provider order email", async () => {
    db.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "replacement_user" });
    const res = await POST(
      signedRequest(payload({ attrs: { user_email: "  U@TEST.DEV  " } })),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "processed" });
    expect(db.user.findUnique).toHaveBeenNthCalledWith(2, {
      where: { email: "u@test.dev" },
      select: { id: true },
    });
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "replacement_user" },
        data: { credits: { increment: 500 } },
      }),
    );
    expect(db.walletTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "replacement_user",
          referenceId: "ls_order_1001",
        }),
      }),
    );
  });

  it("does not send a malformed but signed user ID to Prisma", async () => {
    db.user.findUnique.mockResolvedValue({ id: "user_1" });
    const res = await POST(
      signedRequest(
        payload({ custom: buildCheckoutCustomData("bad user id", topup) }),
      ),
    );
    expect(res.status).toBe(200);
    expect(db.user.findUnique).toHaveBeenCalledTimes(1);
    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { email: "u@test.dev" },
      select: { id: true },
    });
  });

  it.each([
    {},
    { ...buildCheckoutCustomData("user_1", topup), user_id: "" },
    { ...buildCheckoutCustomData("user_1", topup), sig: "bad-signature" },
  ])(
    "never grants an unsigned or malformed checkout using email alone",
    async (custom) => {
      const res = await POST(signedRequest(payload({ custom })));
      expect(await res.json()).toMatchObject({ status: "rejected" });
      expect(db.user.findUnique).not.toHaveBeenCalled();
      expect(db.user.update).not.toHaveBeenCalled();
      expect(db.walletTransaction.create).not.toHaveBeenCalled();
    },
  );

  it("returns a clean retryable response when neither identity can be resolved", async () => {
    db.user.findUnique.mockResolvedValue(null);
    const res = await POST(
      signedRequest(payload({ attrs: { user_email: "invalid-email" } })),
    );
    expect(res.status).toBe(422);
    expect(db.user.findUnique).toHaveBeenCalledTimes(1);
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.walletTransaction.create).not.toHaveBeenCalled();
  });

  it("uses a scalar advisory-lock query instead of deserializing PostgreSQL void", async () => {
    await POST(signedRequest(payload()));
    const [sql, orderKey] = db.$queryRaw.mock.calls[0];
    expect(sql.join("?")).toContain(
      "SELECT 1 AS locked FROM pg_advisory_xact_lock",
    );
    expect(orderKey).toBe("lemonsqueezy:order:1001");
  });

  it("skips a committed wallet reference even if the webhook event was not recorded", async () => {
    db.walletTransaction.findFirst.mockResolvedValue({ id: "existing_ledger" });
    const res = await POST(signedRequest(payload()));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "processed" });
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.walletTransaction.create).not.toHaveBeenCalled();
  });

  it.each(["P2003", "P2025"])(
    "returns a clean retryable response and logs %s details",
    async (code) => {
      db.walletTransaction.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Relation unavailable", {
          code,
          clientVersion: "test",
          meta: {
            target: ["userId"],
            field_name: "WalletTransaction_userId_fkey",
            modelName: "WalletTransaction",
          },
        }),
      );
      const res = await POST(signedRequest(payload()));
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ error: "Webhook processing failed" });
      expect(console.error).toHaveBeenCalledWith(
        "[LS_WEBHOOK_FAILED] ls:order_created:1001:",
        expect.objectContaining({
          code,
          target: ["userId"],
          fieldName: "WalletTransaction_userId_fkey",
        }),
      );
    },
  );

  it("logs raw query Prisma and PostgreSQL error codes", async () => {
    db.$queryRaw.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Raw query failed", {
        code: "P2010",
        clientVersion: "test",
        meta: { code: "42703", message: "column unavailable" },
      }),
    );
    const res = await POST(signedRequest(payload()));
    expect(res.status).toBe(500);
    expect(console.error).toHaveBeenCalledWith(
      "[LS_WEBHOOK_FAILED] ls:order_created:1001:",
      expect.objectContaining({
        code: "P2010",
        databaseCode: "42703",
        target: null,
      }),
    );
  });

  it("does not leak an error if duplicate verification and failure recording also fail", async () => {
    db.walletTransaction.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["id"] },
      }),
    );
    db.webhookEvent.findUnique
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("Database unavailable"));
    db.webhookEvent.upsert.mockRejectedValue(
      new Error("Recording unavailable"),
    );
    const res = await POST(signedRequest(payload()));
    expect(res.status).toBe(500);
    expect(console.error).toHaveBeenCalledWith(
      "[LS_WEBHOOK_DUPLICATE_LOOKUP_FAILED] ls:order_created:1001:",
      expect.any(Object),
    );
    expect(console.error).toHaveBeenCalledWith(
      "[LS_WEBHOOK_EVENT_RECORD_FAILED] ls:order_created:1001:",
      expect.any(Object),
    );
  });
});
