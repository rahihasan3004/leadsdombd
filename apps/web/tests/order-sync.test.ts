import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  purchase: vi.fn(),
  throttle: vi.fn(),
  runner: vi.fn(),
}));
vi.mock("@fine-leads/auth", () => ({ auth: mocks.auth }));
vi.mock("@fine-leads/database", () => ({
  db: {
    leadPurchase: { findFirst: mocks.purchase },
    leadFulfillmentJob: { updateMany: mocks.throttle },
  },
}));
vi.mock("@/lib/scraper/fulfillment-runner", () => ({
  advanceOrderFulfillment: mocks.runner,
}));
import { POST } from "../app/api/purchases/[purchaseId]/sync/route";
const request = (origin?: string) =>
  new Request("https://app.test/api/purchases/p1/sync", {
    method: "POST",
    headers: origin ? { origin } : {},
  });
const context = { params: Promise.resolve({ purchaseId: "p1" }) };
beforeEach(() => {
  mocks.auth.mockReset().mockResolvedValue({ user: { id: "u1" } });
  mocks.purchase.mockReset().mockResolvedValue({
    status: "PROCESSING",
    createdAt: new Date(Date.now() - 240_000),
    fulfillmentJob: { id: "j1" },
  });
  mocks.throttle.mockReset().mockResolvedValue({ count: 1 });
  mocks.runner.mockReset().mockResolvedValue({
    worked: true,
    steps: 2,
    outcomes: [{ purchaseId: "p1", status: "COMPLETED" }],
  });
});
afterEach(() => vi.restoreAllMocks());
describe("owner-only active order recovery", () => {
  it("requires authentication before database access", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await POST(request(), context)).status).toBe(401);
    expect(mocks.purchase).not.toHaveBeenCalled();
  });
  it("rejects a cross-origin request", async () => {
    expect((await POST(request("https://attacker.test"), context)).status).toBe(
      403,
    );
    expect(mocks.runner).not.toHaveBeenCalled();
  });
  it("checks ownership without exposing someone else's order", async () => {
    mocks.purchase.mockResolvedValue(null);
    expect((await POST(request(), context)).status).toBe(404);
    expect(mocks.purchase).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p1", userId: "u1" } }),
    );
    expect(mocks.runner).not.toHaveBeenCalled();
  });
  it("actively resolves a recent processing order without a three-minute delay", async () => {
    mocks.purchase
      .mockResolvedValueOnce({
        status: "PROCESSING",
        createdAt: new Date(),
        fulfillmentJob: { id: "j1" },
      })
      .mockResolvedValueOnce({ status: "COMPLETED" });
    expect(await (await POST(request(), context)).json()).toEqual({
      status: "COMPLETED",
      syncStatus: "COMPLETED",
    });
    expect(mocks.throttle).toHaveBeenCalledOnce();
    expect(mocks.runner).toHaveBeenCalledOnce();
  });
  it.each(["COMPLETED", "REFUNDED", "FAILED"])(
    "never reprocesses a %s order",
    async (status) => {
      mocks.purchase.mockResolvedValue({
        status,
        createdAt: new Date(0),
        fulfillmentJob: { id: "j1" },
      });
      expect(await (await POST(request(), context)).json()).toEqual({
        status,
        syncStatus: "NOT_PENDING",
      });
      expect(mocks.runner).not.toHaveBeenCalled();
    },
  );
  it("does not fabricate a missing durable job", async () => {
    mocks.purchase.mockResolvedValue({
      status: "PROCESSING",
      createdAt: new Date(0),
      fulfillmentJob: null,
    });
    expect(await (await POST(request(), context)).json()).toMatchObject({
      syncStatus: "NO_FULFILLMENT_JOB",
    });
    expect(mocks.runner).not.toHaveBeenCalled();
  });
  it("honors shared throttle and active leases", async () => {
    mocks.throttle.mockResolvedValue({ count: 0 });
    expect(await (await POST(request(), context)).json()).toMatchObject({
      syncStatus: "BUSY_OR_THROTTLED",
    });
    expect(mocks.runner).not.toHaveBeenCalled();
    expect(mocks.throttle.mock.calls[0]![0].where).toMatchObject({
      purchaseId: "p1",
      updatedAt: { lte: expect.any(Date) },
      OR: [{ leaseUntil: null }, { leaseUntil: { lte: expect.any(Date) } }],
    });
  });
  it("advances only this owned order and reports its committed status", async () => {
    mocks.purchase
      .mockResolvedValueOnce({
        status: "PROCESSING",
        createdAt: new Date(0),
        fulfillmentJob: { id: "j1" },
      })
      .mockResolvedValueOnce({ status: "COMPLETED" });
    const response = await POST(request("https://app.test"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      status: "COMPLETED",
      syncStatus: "COMPLETED",
    });
    expect(mocks.runner).toHaveBeenCalledExactlyOnceWith({
      purchaseId: "p1",
      budgetMs: 55_000,
      maxSteps: 4,
    });
  });
  it("keeps verification waits processing rather than faking completion", async () => {
    mocks.runner.mockResolvedValue({
      outcomes: [{ status: "WAITING_VERIFICATION" }],
    });
    expect(await (await POST(request(), context)).json()).toEqual({
      status: "PROCESSING",
      syncStatus: "WAITING_VERIFICATION",
    });
  });
  it("returns a retryable generic error without exposing provider secrets", async () => {
    mocks.runner.mockRejectedValue(new Error("LOBSTR_API_KEY=secret"));
    const response = await POST(request(), context);
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain(
      "LOBSTR_API_KEY",
    );
  });
});
