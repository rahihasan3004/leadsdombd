import { z } from "zod";
import type { LeadTier } from "@fine-leads/utils";
import { getLeadCreditCost } from "@fine-leads/utils";
import {
  getZipCodesForState,
  getNextAvailableZips,
} from "@fine-leads/utils/territories/us-zip-codes";
export const MAX_PARALLEL_WORKERS = 50;
export const parallelConfigSchema = z.object({
  version: z.literal(1),
  batchSize: z.number().int().min(50).max(100),
  concurrency: z.number().int().min(1).max(MAX_PARALLEL_WORKERS),
  accountConcurrency: z.number().int().min(1).max(MAX_PARALLEL_WORKERS),
  creditsPerResult: z.number().int().min(1).max(10_000),
  maxProviderCredits: z.number().int().positive().max(2_000_000_000),
});
export type ParallelConfig = z.infer<typeof parallelConfigSchema>;
export class ParallelConfigurationError extends Error {}
export const parallelFulfillmentEnabled = () =>
  process.env.LOBSTR_PARALLEL_ENABLED === "true";
function setting(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new ParallelConfigurationError(`Invalid parallel setting: ${name}`);
  return value;
}
export function createParallelPlan(
  states: string[],
  quantity: number,
  tier: LeadTier,
  creditsHeld: number,
) {
  if (
    !states.length ||
    new Set(states).size !== states.length ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    creditsHeld !== getLeadCreditCost(quantity, tier)
  )
    throw new ParallelConfigurationError("Invalid funded parallel order");
  const creditsPerResult = setting(
    "LOBSTR_ESTIMATED_CREDITS_PER_RESULT",
    0,
    1,
    10_000,
  );
  const batchSize = setting("LOBSTR_BATCH_SIZE", 100, 50, 100);
  const accountConcurrency = setting(
    "LOBSTR_MAX_CONCURRENT_RUNS",
    MAX_PARALLEL_WORKERS,
    1,
    MAX_PARALLEL_WORKERS,
  );
  const concurrency = Math.max(
    1,
    Math.min(
      accountConcurrency,
      Math.floor(
        creditsHeld / getLeadCreditCost(Math.min(quantity, batchSize), tier),
      ),
    ),
  );
  const config = parallelConfigSchema.parse({
    version: 1,
    batchSize,
    concurrency,
    accountConcurrency,
    creditsPerResult,
    maxProviderCredits:
      quantity *
      creditsPerResult *
      setting("LOBSTR_BACKUP_BUDGET_MULTIPLIER", 2, 1, 3),
  });
  const runs: Array<{
    state: string;
    zipCode: string;
    targetQuantity: number;
  }> = [];
  states.forEach((state, index) => {
    let remaining =
      Math.floor(quantity / states.length) +
      (index < quantity % states.length ? 1 : 0);
    const zips = getZipCodesForState(state);
    if (!zips.length || remaining > zips.length * batchSize)
      throw new ParallelConfigurationError(
        "Insufficient distinct ZIP coverage for this plan",
      );
    let cursor = 0;
    while (remaining > 0) {
      const targetQuantity = Math.min(batchSize, remaining);
      runs.push({ state, zipCode: zips[cursor++]!, targetQuantity });
      remaining -= targetQuantity;
    }
  });
  return { config, runs };
}
export function nextBackupZip(state: string, used: Set<string>) {
  return getNextAvailableZips(state, 1, [...used])[0];
}
export function availableProviderCapacity(
  balance: {
    available: number;
    consumed: number;
    used_slots: number;
    total_available_slots: number;
    has_unpaid_bill: { status?: boolean };
  },
  config: ParallelConfig,
  held: {
    globalSlots: number;
    pendingSlots: number;
    orderSlots: number;
    credits: number;
    committedOrderCredits: number;
  },
) {
  if (balance.has_unpaid_bill.status) return { slots: 0, credits: 0 };
  return {
    // Conservative: count all local reservations against both the app and the provider view.
    slots: Math.max(
      0,
      Math.min(
        config.concurrency - held.orderSlots,
        config.accountConcurrency - held.globalSlots,
        balance.total_available_slots - balance.used_slots - held.pendingSlots,
      ),
    ),
    credits: Math.max(
      0,
      Math.min(
        balance.available - balance.consumed - held.credits,
        config.maxProviderCredits - held.committedOrderCredits,
      ),
    ),
  };
}
