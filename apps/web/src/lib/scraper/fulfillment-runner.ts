import { maintainParallelCapacity } from "./parallel-dispatcher";
import { processNextFulfillment } from "./order-fulfillment";

/** Advance durable stages within a finite HTTP budget, never poll/sleep indefinitely. */
export async function advanceOrderFulfillment(
  options: {
    purchaseId?: string;
    budgetMs?: number;
    maxSteps?: number;
  } = {},
) {
  const budget = Math.max(35_000, Math.min(70_000, options.budgetMs ?? 70_000));
  const deadline = Date.now() + budget;
  try {
    await maintainParallelCapacity(5);
  } catch {
    console.warn("[LOBSTR_CAPACITY_CLEANUP_DEFERRED]");
  }
  const maxSteps = Math.max(1, Math.min(8, options.maxSteps ?? 6));
  const outcomes: Array<{ purchaseId?: string; status: string }> = [];
  for (
    let step = 0;
    step < maxSteps && Date.now() + 30_000 < deadline;
    step++
  ) {
    const result = await processNextFulfillment({
      ...(options.purchaseId ? { purchaseId: options.purchaseId } : {}),
      budgetMs: Math.min(45_000, deadline - Date.now()),
    });
    outcomes.push({
      ...(result.purchaseId ? { purchaseId: result.purchaseId } : {}),
      status: result.status,
    });
    if (!result.worked) break;
    // For owner sync, upstream polling/backoff/SMTP waits must await a later request.
    // A scheduler may move to a different due job; the DB retains fairness/backoff.
    if (
      options.purchaseId &&
      !["DISPATCHED", "INGESTING", "VERIFYING", "RETRY_QUEUED"].includes(
        result.status,
      )
    )
      break;
  }
  return {
    worked: outcomes.some(
      (result) => !["IDLE", "BUSY", "LEASE_LOST"].includes(result.status),
    ),
    steps: outcomes.length,
    outcomes,
  };
}
