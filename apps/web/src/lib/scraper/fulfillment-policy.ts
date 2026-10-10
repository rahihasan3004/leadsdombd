import type { Prisma } from "@fine-leads/database";
import { type LeadTier } from "@fine-leads/utils";
import { leadInventoryWhere } from "../lead-access";
import { configuredApifyTokens } from "./apify-token-pool";

export const FULFILLMENT_CATEGORY = "real estate agents";
export const FRESHNESS_DAYS = 90;
export const FULFILLMENT_TTL_MS = 24 * 60 * 60 * 1000;

export function fulfillmentConfigured(): boolean {
  const apify =
    process.env.APIFY_FULFILLMENT_ENABLED === "true" &&
    configuredApifyTokens().length > 0;
  if (process.env.SCRAPER_PROVIDER === "apify") return apify;
  if (apify && process.env.SCRAPER_FALLBACK_PROVIDER === "apify") return true;
  return (
    process.env.LOBSTR_FULFILLMENT_ENABLED === "true" &&
    Boolean(process.env.LOBSTR_API_KEY?.trim())
  );
}

/** Missing source timestamps fall back to ingestion time, never to an arbitrary recent update. */
export function freshInventoryWhere(
  userId: string,
  states: string[],
  tier: LeadTier,
  now = new Date(),
): Prisma.AgentWhereInput {
  const cutoff = new Date(now.getTime() - FRESHNESS_DAYS * 86_400_000);
  return {
    state: { in: states },
    ...leadInventoryWhere(tier),
    OR: [
      { scrapedAt: { gte: cutoff } },
      { lastVerifiedAt: { gte: cutoff } },
      { scrapedAt: null, lastVerifiedAt: null, createdAt: { gte: cutoff } },
    ],
    unlockedBy: { none: { userId } },
  };
}

/** Distribute the shortage across selected territories; cap each provider run at 10k. */
export function planFulfillmentRuns(states: string[], shortage: number) {
  if (!states.length || !Number.isSafeInteger(shortage) || shortage < 1)
    throw new Error("Invalid fulfillment plan");
  const plans: Array<{ state: string; targetQuantity: number }> = [];
  states.forEach((state, index) => {
    let quantity =
      Math.floor(shortage / states.length) +
      (index < shortage % states.length ? 1 : 0);
    while (quantity > 0) {
      const targetQuantity = Math.min(10_000, quantity);
      plans.push({ state, targetQuantity });
      quantity -= targetQuantity;
    }
  });
  return plans;
}

export interface EmailVerificationResult {
  email: string;
  status: string;
  isDeliverable: boolean;
  isCatchAll: boolean;
  isDisposable: boolean;
  smtpCode: number | null;
}
export function isSmtpDeliverable(
  result: EmailVerificationResult,
  email: string,
): boolean {
  return (
    result.email.trim().toLowerCase() === email.trim().toLowerCase() &&
    ["deliverable", "validated"].includes(result.status) &&
    result.isDeliverable &&
    !result.isCatchAll &&
    !result.isDisposable &&
    [250, 251].includes(result.smtpCode ?? 0)
  );
}
