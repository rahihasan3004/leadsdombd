export const VAULT_SYNC_INTERVAL_MS = 8000;
const REQUEST_TIMEOUT_MS = 65000;
const ORDER_STATUSES = new Set([
  "PROCESSING",
  "COMPLETED",
  "REFUNDED",
  "FAILED",
]);
export interface VaultOrderSyncOptions {
  onStatus: (purchaseId: string, status: string) => void;
  onError: (purchaseId: string, message: string) => void;
  fetcher?: typeof fetch;
}
/** One request per visible order at a time. Changing pagination never cancels unrelated orders. */
export function createVaultOrderSync(options: VaultOrderSyncOptions) {
  const fetcher = options.fetcher ?? fetch;
  const targets = new Set<string>();
  const active = new Map<string, AbortController>();
  const attemptedAt = new Map<string, number>();
  const failed = new Set<string>();
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  async function sync(purchaseId: string) {
    const controller = new AbortController();
    active.set(purchaseId, controller);
    attemptedAt.set(purchaseId, Date.now());
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetcher(
        `/api/purchases/${encodeURIComponent(purchaseId)}/sync`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        if ([401, 403, 404].includes(response.status))
          targets.delete(purchaseId);
        throw new Error(
          response.status === 401
            ? "Please sign in again to sync your order."
            : "Order sync failed. Status checks will retry automatically.",
        );
      }
      const result: unknown = await response.json();
      if (
        !result ||
        typeof result !== "object" ||
        !("status" in result) ||
        typeof result.status !== "string" ||
        !ORDER_STATUSES.has(result.status)
      )
        throw new Error(
          "Invalid order sync response. Status checks will retry automatically.",
        );
      if (stopped || controller.signal.aborted || !targets.has(purchaseId))
        return;
      failed.delete(purchaseId);
      if (result.status !== "PROCESSING") targets.delete(purchaseId);
      options.onStatus(purchaseId, result.status);
    } catch (error) {
      // Removed orders and unmounted views must never deliver stale UI updates or toasts.
      if (
        !stopped &&
        active.get(purchaseId) === controller &&
        (!controller.signal.aborted || targets.has(purchaseId)) &&
        !failed.has(purchaseId)
      ) {
        failed.add(purchaseId);
        options.onError(
          purchaseId,
          controller.signal.aborted
            ? "Order sync timed out. Status checks will retry automatically."
            : error instanceof Error
              ? error.message
              : "Order sync failed. Status checks will retry automatically.",
        );
      }
    } finally {
      clearTimeout(timeout);
      if (active.get(purchaseId) === controller) active.delete(purchaseId);
      updateTimer();
    }
  }
  function tick() {
    if (stopped || document.visibilityState !== "visible") return;
    const now = Date.now();
    for (const purchaseId of targets) {
      if (active.has(purchaseId)) continue;
      const lastAttempt = attemptedAt.get(purchaseId);
      if (
        lastAttempt !== undefined &&
        now - lastAttempt < VAULT_SYNC_INTERVAL_MS
      )
        continue;
      void sync(purchaseId);
    }
  }
  function updateTimer() {
    if (targets.size && !timer && !stopped)
      timer = setInterval(tick, VAULT_SYNC_INTERVAL_MS);
    if ((!targets.size || stopped) && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  }
  const onFocus = () => tick();
  document.addEventListener("visibilitychange", onFocus);
  window.addEventListener("focus", onFocus);
  return {
    setPurchaseIds(ids: string[]) {
      if (stopped) return;
      const next = new Set(ids);
      for (const id of targets)
        if (!next.has(id)) {
          targets.delete(id);
          active.get(id)?.abort();
          active.delete(id);
          attemptedAt.delete(id);
          failed.delete(id);
        }
      for (const id of next) targets.add(id);
      updateTimer();
      tick();
    },
    stop() {
      stopped = true;
      targets.clear();
      updateTimer();
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
      for (const controller of active.values()) controller.abort();
      active.clear();
      attemptedAt.clear();
      failed.clear();
    },
  };
}
