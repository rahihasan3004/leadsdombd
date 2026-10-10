import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createVaultOrderSync,
  VAULT_SYNC_INTERVAL_MS,
} from "@/lib/vault-order-sync";
let doc: EventTarget & { visibilityState: string };
let win: EventTarget;
const response = (status = "PROCESSING") =>
  new Response(JSON.stringify({ status }));
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));
  doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  win = new EventTarget();
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", win);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function setup(
  fetcher = vi.fn<typeof fetch>().mockImplementation(async () => response()),
) {
  const onStatus = vi.fn();
  const onError = vi.fn();
  const sync = createVaultOrderSync({ fetcher, onStatus, onError });
  return { sync, fetcher, onStatus, onError };
}
describe("visible Vault order active sync", () => {
  it("POSTs every visible processing order immediately and every eight seconds", async () => {
    const { sync, fetcher } = setup();
    sync.setPurchaseIds(["p1", "p2", "p1"]);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(7999);
    expect(fetcher).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(VAULT_SYNC_INTERVAL_MS).toBe(8000);
    expect(fetcher.mock.calls[0]).toEqual([
      "/api/purchases/p1/sync",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    ]);
    sync.stop();
  });
  it("does not start requests when no processing order is visible", async () => {
    const { sync, fetcher } = setup();
    sync.setPurchaseIds([]);
    await vi.advanceTimersByTimeAsync(32000);
    expect(fetcher).not.toHaveBeenCalled();
    sync.stop();
  });
  it("pauses in a hidden tab and catches up when it becomes visible", async () => {
    doc.visibilityState = "hidden";
    const { sync, fetcher } = setup();
    sync.setPurchaseIds(["p1"]);
    await vi.advanceTimersByTimeAsync(24000);
    expect(fetcher).not.toHaveBeenCalled();
    doc.visibilityState = "visible";
    doc.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledOnce();
    win.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledOnce();
    sync.stop();
  });
  it("never overlaps long-running syncs for the same order", async () => {
    let finish!: (value: Response) => void;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockImplementation(async () => response());
    const { sync } = setup(fetcher);
    sync.setPurchaseIds(["p1"]);
    await vi.advanceTimersByTimeAsync(24000);
    expect(fetcher).toHaveBeenCalledOnce();
    finish(response());
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(8000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    sync.stop();
  });
  it("a list refresh or another order completing never cancels an unrelated in-flight sync", async () => {
    const signals = new Map<string, AbortSignal>();
    let completeFirst!: (value: Response) => void;
    const fetcher = vi.fn<typeof fetch>().mockImplementation((url, init) => {
      signals.set(String(url), init!.signal!);
      return new Promise((resolve) => {
        if (String(url).includes("p1")) completeFirst = resolve;
      });
    });
    const { sync, onStatus } = setup(fetcher);
    sync.setPurchaseIds(["p1", "p2"]);
    sync.setPurchaseIds(["p1", "p2"]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    completeFirst(response("COMPLETED"));
    await vi.advanceTimersByTimeAsync(0);
    expect(onStatus).toHaveBeenCalledWith("p1", "COMPLETED");
    sync.setPurchaseIds(["p2"]);
    expect(signals.get("/api/purchases/p2/sync")!.aborted).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
    sync.stop();
  });
  it.each(["COMPLETED", "REFUNDED", "FAILED"])(
    "updates %s immediately and stops polling that order",
    async (status) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockImplementation(async () => response(status));
      const { sync, onStatus } = setup(fetcher);
      sync.setPurchaseIds(["p1"]);
      await vi.advanceTimersByTimeAsync(0);
      expect(onStatus).toHaveBeenCalledWith("p1", status);
      await vi.advanceTimersByTimeAsync(32000);
      expect(fetcher).toHaveBeenCalledOnce();
      sync.stop();
    },
  );
  it("pagination removes requests cleanly and ignores their late responses", async () => {
    let finish!: (value: Response) => void;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { sync, onStatus, onError } = setup(fetcher);
    sync.setPurchaseIds(["old"]);
    const signal = fetcher.mock.calls[0]![1]!.signal!;
    sync.setPurchaseIds([]);
    expect(signal.aborted).toBe(true);
    finish(response("COMPLETED"));
    await vi.advanceTimersByTimeAsync(0);
    expect(onStatus).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    sync.stop();
  });
  it("cleanup cancels requests, timers and focus listeners without stale notifications", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init!.signal!.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const { sync, onStatus, onError } = setup(fetcher);
    sync.setPurchaseIds(["p1"]);
    sync.stop();
    await vi.advanceTimersByTimeAsync(32000);
    win.dispatchEvent(new Event("focus"));
    expect(fetcher).toHaveBeenCalledOnce();
    expect(onStatus).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
  it("retries transient errors and reports them once until a successful sync", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response("busy", { status: 503 }));
    const { sync, onError } = setup(fetcher);
    sync.setPurchaseIds(["p1"]);
    await vi.advanceTimersByTimeAsync(16000);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0]![1]).toContain("retry automatically");
    sync.stop();
  });
  it("times out hung requests and retries instead of permanently deadlocking the order", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init!.signal!.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const { sync, onError } = setup(fetcher);
    sync.setPurchaseIds(["p1"]);
    await vi.advanceTimersByTimeAsync(65000);
    expect(onError).toHaveBeenCalledWith(
      "p1",
      expect.stringContaining("timed out"),
    );
    await vi.advanceTimersByTimeAsync(7000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    sync.stop();
  });
  it.each([401, 403, 404])(
    "stops rejected HTTP %s orders and shows a clear error",
    async (status) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockImplementation(async () => new Response("denied", { status }));
      const { sync, onError } = setup(fetcher);
      sync.setPurchaseIds(["p1"]);
      await vi.advanceTimersByTimeAsync(24000);
      expect(fetcher).toHaveBeenCalledOnce();
      expect(onError).toHaveBeenCalledOnce();
      sync.stop();
    },
  );
  it("rejects invalid status payloads rather than faking completion", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => response("made-up"));
    const { sync, onError, onStatus } = setup(fetcher);
    sync.setPurchaseIds(["p1"]);
    await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalled();
    expect(onStatus).not.toHaveBeenCalled();
    sync.stop();
  });
  it("encodes order IDs into the endpoint path", async () => {
    const { sync, fetcher } = setup();
    sync.setPurchaseIds(["p /?#"]);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher.mock.calls[0]![0]).toBe("/api/purchases/p%20%2F%3F%23/sync");
    sync.stop();
  });
});
