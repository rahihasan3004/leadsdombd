import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  configured: true,
  notifications: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
  purchase: vi.fn(),
}));
vi.mock("../src/lib/email", () => ({
  get resend() {
    return mocks.configured ? { emails: { send: mocks.send } } : null;
  },
  EMAIL_FROM: "LeadsDom <orders@example.com>",
}));
vi.mock("@fine-leads/database", () => ({
  db: {
    orderEmailNotification: mocks.notifications,
    leadPurchase: { findUnique: mocks.purchase },
  },
}));
import {
  buildOrderEmail,
  enqueueOrderEmail,
  sendOrderProcessingEmail,
  sendOrderCompletedEmail,
  sendOrderFailedEmail,
  processPendingOrderEmails,
  type OrderEmailDetails,
} from "../src/lib/email/order-emails";

const details: OrderEmailDetails = {
  referenceId: "LD-42",
  name: "Customer",
  states: ["TX", "CA"],
  quantity: 100,
  deliveredCount: 100,
  tier: "VERIFIED_EMAIL",
  creditsRefunded: 200,
};
type Row = {
  id: string;
  purchaseId: string;
  kind: string;
  status: string;
  payload: unknown;
  attempts: number;
  firstAttemptAt: Date | null;
  nextAttemptAt: Date;
  leaseToken: string | null;
  leaseUntil: Date | null;
  lastError?: string | null;
  providerId?: string;
  sentAt?: Date;
};
let row: Row;
let purchase: {
  referenceId: string;
  tier: string;
  status: string;
  leadCount: number;
  unlockedStates: string[];
  user: { email: string; name: string };
  fulfillmentJob: { creditsHeld: number } | null;
  _count: { unlockedLeads: number };
};
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://leads.example.com");
  mocks.configured = true;
  row = {
    id: "n1",
    purchaseId: "p1",
    kind: "PROCESSING",
    status: "PENDING",
    payload: null,
    attempts: 0,
    firstAttemptAt: null,
    nextAttemptAt: new Date(0),
    leaseToken: null,
    leaseUntil: null,
  };
  purchase = {
    referenceId: "LD-42",
    tier: "VERIFIED_EMAIL",
    status: "PROCESSING",
    leadCount: 100,
    unlockedStates: ["TX", "CA"],
    user: { email: "customer@example.com", name: "Customer" },
    fulfillmentJob: { creditsHeld: 200 },
    _count: { unlockedLeads: 100 },
  };
  for (const method of Object.values(mocks.notifications)) method.mockReset();
  mocks.send
    .mockReset()
    .mockResolvedValue({ data: { id: "resend-1" }, error: null });
  mocks.purchase.mockReset().mockImplementation(async () => purchase);
  mocks.notifications.upsert.mockImplementation(async () => ({ ...row }));
  mocks.notifications.findUnique.mockImplementation(async () => ({ ...row }));
  mocks.notifications.findUniqueOrThrow.mockImplementation(async () => ({
    ...row,
  }));
  mocks.notifications.findMany.mockImplementation(async () => [{ id: row.id }]);
  mocks.notifications.updateMany.mockImplementation(async ({ where, data }) => {
    if (where.leaseToken && where.leaseToken !== row.leaseToken)
      return { count: 0 };
    if (
      where.status &&
      (!where.status.in.includes(row.status) ||
        row.nextAttemptAt > new Date() ||
        (row.leaseUntil && row.leaseUntil > new Date()))
    )
      return { count: 0 };
    Object.assign(row, data);
    return { count: 1 };
  });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("branded order email templates", () => {
  it.each(["PROCESSING", "COMPLETED", "FAILED"] as const)(
    "renders %s HTML and plaintext with order reference and tier",
    (kind) => {
      const email = buildOrderEmail(kind, details);
      expect(email.html).toContain("LeadsDom");
      expect(email.text).toContain("LD-42");
      expect(email.text).toContain("TX, CA");
      expect(email.text).toContain("Full Outreach");
      expect(email.html).toContain(
        "https://leads.example.com/dashboard/lists?order=LD-42",
      );
    },
  );
  it("clarifies Cold Calling excludes email", () => {
    const email = buildOrderEmail("PROCESSING", {
      ...details,
      tier: "PHONE_ONLY",
    });
    expect(email.text).toContain("Cold Calling");
    expect(email.text).toContain("does not include email addresses");
    expect(email.text).not.toContain("SMTP email deliverability");
  });
  it("uses actual delivered and refunded amounts", () => {
    expect(
      buildOrderEmail("COMPLETED", { ...details, deliveredCount: 99 }).text,
    ).toContain("Delivered Leads: 99");
    expect(buildOrderEmail("FAILED", details).text).toContain(
      "Credits Refunded: 200",
    );
  });
  it("escapes HTML and safely encodes the Vault reference", () => {
    const email = buildOrderEmail("PROCESSING", {
      ...details,
      name: '<img src=x onerror="alert(1)">',
      referenceId: "A&B\r\nHeader",
      states: ["<script>"],
    });
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("&lt;img");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("order=A%26B%0D%0AHeader");
    expect(email.subject).not.toMatch(/[\r\n]/);
  });
  it("rejects missing or unsafe app URLs", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(() => buildOrderEmail("PROCESSING", details)).toThrow(
      "APP_URL_NOT_CONFIGURED",
    );
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "javascript:alert(1)");
    expect(() => buildOrderEmail("PROCESSING", details)).toThrow(
      "INVALID_APP_URL",
    );
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://user:secret@leads.example.com");
    expect(() => buildOrderEmail("PROCESSING", details)).toThrow(
      "INVALID_APP_URL",
    );
  });
});

describe("durable notification delivery", () => {
  it("enqueues idempotently without calling the provider", async () => {
    await enqueueOrderEmail(
      { orderEmailNotification: mocks.notifications } as unknown as Parameters<
        typeof enqueueOrderEmail
      >[0],
      "p1",
      "PROCESSING",
    );
    expect(mocks.notifications.upsert).toHaveBeenCalledWith({
      where: { purchaseId_kind: { purchaseId: "p1", kind: "PROCESSING" } },
      create: { purchaseId: "p1", kind: "PROCESSING" },
      update: {},
    });
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("sends and saves acceptance, then suppresses replay", async () => {
    expect(await sendOrderProcessingEmail("p1")).toEqual({
      success: true,
      status: "SENT",
    });
    expect(row.providerId).toBe("resend-1");
    expect(row.sentAt).toBeInstanceOf(Date);
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "LeadsDom <orders@example.com>",
        to: "customer@example.com",
      }),
      { idempotencyKey: "order-email/p1/processing" },
    );
    expect(await sendOrderProcessingEmail("p1")).toEqual({
      success: true,
      status: "ALREADY_SENT",
    });
    expect(mocks.send).toHaveBeenCalledOnce();
  });
  it.each(["COMPLETED", "FAILED"] as const)(
    "sends the eligible %s event",
    async (kind) => {
      row.kind = kind;
      purchase.status = kind === "FAILED" ? "REFUNDED" : kind;
      const result = await (kind === "FAILED"
        ? sendOrderFailedEmail("p1")
        : sendOrderCompletedEmail("p1"));
      expect(result.status).toBe("SENT");
      expect(mocks.send.mock.calls[0]![1]).toEqual({
        idempotencyKey: `order-email/p1/${kind.toLowerCase()}`,
      });
    },
  );
  it("keeps a failed provider response pending without leaking its message", async () => {
    mocks.send.mockResolvedValue({
      data: null,
      error: { message: "secret-token customer@example.com" },
    });
    expect((await sendOrderProcessingEmail("p1")).status).toBe("DEFERRED");
    expect(row.status).toBe("PENDING");
    expect(row.lastError).toBe("RESEND_REJECTED");
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(
      "secret-token",
    );
  });
  it("handles SDK exceptions and retries with exactly the same payload", async () => {
    mocks.send.mockRejectedValueOnce(new Error("provider unavailable"));
    await sendOrderProcessingEmail("p1");
    const payload = mocks.send.mock.calls[0]![0];
    purchase.user = { email: "changed@example.com", name: "Changed" };
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://changed.example.com");
    row.nextAttemptAt = new Date(0);
    expect((await sendOrderProcessingEmail("p1")).status).toBe("SENT");
    expect(mocks.send.mock.calls[1]).toEqual([
      payload,
      { idempotencyKey: "order-email/p1/processing" },
    ]);
  });
  it("does not pretend success or consume attempts if Resend is missing", async () => {
    mocks.configured = false;
    expect((await sendOrderProcessingEmail("p1")).status).toBe("DEFERRED");
    expect(row.status).toBe("PENDING");
    expect(row.attempts).toBe(0);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("does not send while another worker holds the lease", async () => {
    row.leaseToken = "other";
    row.leaseUntil = new Date(Date.now() + 60_000);
    expect((await sendOrderProcessingEmail("p1")).status).toBe(
      "BUSY_OR_BACKOFF",
    );
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("only one competing worker can send", async () => {
    await Promise.all([
      sendOrderProcessingEmail("p1"),
      sendOrderProcessingEmail("p1"),
    ]);
    expect(mocks.send).toHaveBeenCalledOnce();
  });
  it("recovers an expired sending lease", async () => {
    row.status = "SENDING";
    row.leaseToken = "expired";
    row.leaseUntil = new Date(0);
    expect((await sendOrderProcessingEmail("p1")).status).toBe("SENT");
  });
  it("skips stale processing events when the order is already complete", async () => {
    purchase.status = "COMPLETED";
    expect((await sendOrderProcessingEmail("p1")).status).toBe("SKIPPED");
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("does not send completion before entitlements are ready", async () => {
    row.kind = "COMPLETED";
    purchase.status = "COMPLETED";
    purchase._count.unlockedLeads = 0;
    expect((await sendOrderCompletedEmail("p1")).status).toBe("DEFERRED");
    expect(row.lastError).toBe("ENTITLEMENTS_NOT_READY");
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("does not invent refund amounts", async () => {
    row.kind = "FAILED";
    purchase.status = "REFUNDED";
    purchase.fulfillmentJob = null;
    expect((await sendOrderFailedEmail("p1")).status).toBe("DEFERRED");
    expect(row.lastError).toBe("REFUND_DETAILS_NOT_READY");
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("stops ambiguous replay before the provider's 24-hour key expiry", async () => {
    row.firstAttemptAt = new Date(Date.now() - 23 * 60 * 60 * 1000);
    expect((await sendOrderProcessingEmail("p1")).status).toBe("NEEDS_REVIEW");
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("caps unsuccessful attempts", async () => {
    row.attempts = 7;
    mocks.send.mockRejectedValue(new Error("down"));
    await sendOrderProcessingEmail("p1");
    expect(row.status).toBe("EXHAUSTED");
    expect(row.attempts).toBe(8);
  });
  it("times out a stalled provider without marking it sent", async () => {
    vi.useFakeTimers();
    mocks.send.mockImplementation(() => new Promise(() => undefined));
    const pending = sendOrderProcessingEmail("p1");
    await vi.advanceTimersByTimeAsync(8_001);
    expect((await pending).status).toBe("DEFERRED");
    expect(row.lastError).toBe("EMAIL_TIMEOUT");
    expect(row.status).toBe("PENDING");
  });
  it("flushes terminal events even when there are no fulfillment jobs", async () => {
    row.kind = "COMPLETED";
    purchase.status = "COMPLETED";
    expect(await processPendingOrderEmails()).toEqual({
      sent: 1,
      deferred: 0,
      skipped: 0,
    });
  });
  it("catches unavailable outbox writes and scans", async () => {
    mocks.notifications.upsert.mockRejectedValue(new Error("DB private"));
    expect((await sendOrderProcessingEmail("p1")).status).toBe("DEFERRED");
    mocks.notifications.findMany.mockRejectedValue(new Error("DB private"));
    expect(await processPendingOrderEmails()).toEqual({
      sent: 0,
      deferred: 1,
      skipped: 0,
    });
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
