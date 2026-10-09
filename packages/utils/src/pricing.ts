export interface PricingTier {
  /** Stable identifier sent by the client; the server resolves price/credits from it. */
  id: string;
  credits: number;
  label: string;
  price: number;
  unitPrice: number;
}

export const VOLUME_PRICING_TIERS: readonly PricingTier[] = [
  { id: "tier_500", credits: 500, label: "500", price: 15, unitPrice: 0.030 },
  { id: "tier_1k", credits: 1000, label: "1k", price: 25, unitPrice: 0.025 },
  { id: "tier_2k", credits: 2000, label: "2k", price: 38, unitPrice: 0.019 },
  { id: "tier_10k", credits: 10000, label: "10k", price: 170, unitPrice: 0.017 },
  { id: "tier_30k", credits: 30000, label: "30k", price: 450, unitPrice: 0.015 },
  { id: "tier_50k", credits: 50000, label: "50k", price: 650, unitPrice: 0.013 },
];

export function getTierByCredits(credits: number): PricingTier {
  const tier = VOLUME_PRICING_TIERS.find((t) => t.credits === credits);
  return tier ?? VOLUME_PRICING_TIERS[0];
}

/** Strict lookup used by the server. Returns undefined for unknown ids (no fallback). */
export function findTierById(id: string): PricingTier | undefined {
  return VOLUME_PRICING_TIERS.find((t) => t.id === id);
}

export function getDefaultTier(): PricingTier {
  return VOLUME_PRICING_TIERS[0];
}
