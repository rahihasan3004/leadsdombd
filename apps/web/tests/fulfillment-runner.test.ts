vi.mock("@/lib/scraper/parallel-dispatcher", () => ({
  maintainParallelCapacity: vi.fn().mockResolvedValue(undefined),
}));
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const worker = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/scraper/order-fulfillment", () => ({
  processNextFulfillment: worker,
}));
import { advanceOrderFulfillment } from "../src/lib/scraper/fulfillment-runner";
beforeEach(() => {
  worker.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});
describe("bounded serverless fulfillment runner", () => {
  it("advances polling, ingestion, then completion without another scheduler tick", async () => {
    worker
      .mockResolvedValueOnce({
        worked: true,
        purchaseId: "p1",
        status: "INGESTING",
      })
      .mockResolvedValueOnce({
        worked: true,
        purchaseId: "p1",
        status: "INGESTING",
      })
      .mockResolvedValueOnce({
        worked: true,
        purchaseId: "p1",
        status: "COMPLETED",
      });
    const result = await advanceOrderFulfillment({ purchaseId: "p1" });
    expect(result.steps).toBe(3);
    expect(result.outcomes.at(-1)?.status).toBe("COMPLETED");
    expect(worker).toHaveBeenCalledWith(
      expect.objectContaining({ purchaseId: "p1", budgetMs: 45_000 }),
    );
  });
  it.each([
    "POLLING",
    "WAITING_VERIFICATION",
    "RETRYING",
    "NEEDS_REVIEW",
    "REFUNDED",
  ])("does not tight-loop owner sync on %s", async (status) => {
    worker.mockResolvedValue({ worked: true, purchaseId: "p1", status });
    expect((await advanceOrderFulfillment({ purchaseId: "p1" })).steps).toBe(1);
    expect(worker).toHaveBeenCalledOnce();
  });
  it("stops on an idle queue or contended lease", async () => {
    worker.mockResolvedValue({ worked: false, status: "BUSY" });
    expect((await advanceOrderFulfillment()).worked).toBe(false);
    expect(worker).toHaveBeenCalledOnce();
  });
  it("caps stage count even if every job stays ready", async () => {
    worker.mockResolvedValue({
      worked: true,
      purchaseId: "p1",
      status: "INGESTING",
    });
    expect((await advanceOrderFulfillment({ maxSteps: 100 })).steps).toBe(8);
  });
  it("leaves room for final work when the time budget is consumed", async () => {
    vi.useFakeTimers();
    worker.mockImplementation(async () => {
      vi.advanceTimersByTime(42_000);
      return { worked: true, status: "INGESTING" };
    });
    expect((await advanceOrderFulfillment({ budgetMs: 70_000 })).steps).toBe(1);
  });
  it("lets scheduler claims move to another due order without a user filter", async () => {
    worker
      .mockResolvedValueOnce({
        worked: true,
        purchaseId: "p1",
        status: "WAITING_VERIFICATION",
      })
      .mockResolvedValueOnce({
        worked: true,
        purchaseId: "p2",
        status: "COMPLETED",
      })
      .mockResolvedValueOnce({ worked: false, status: "IDLE" });
    expect((await advanceOrderFulfillment()).steps).toBe(3);
    expect(worker.mock.calls.every(([options]) => !options.purchaseId)).toBe(
      true,
    );
  });
});
