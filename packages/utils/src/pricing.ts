export interface PricingTier {
  credits: number;
  label: string;
  price: number;
  unitPrice: number;
}

export const VOLUME_PRICING_TIERS: PricingTier[] = [
  { credits: 500, label: "500", price: 15, unitPrice: 0.030 },
  { credits: 1000, label: "1k", price: 25, unitPrice: 0.025 },
  { credits: 2000, label: "2k", price: 38, unitPrice: 0.019 },
  { credits: 10000, label: "10k", price: 170, unitPrice: 0.017 },
  { credits: 30000, label: "30k", price: 450, unitPrice: 0.015 },
  { credits: 50000, label: "50k", price: 650, unitPrice: 0.013 },
];

export function getTierByCredits(credits: number): PricingTier {
  const tier = VOLUME_PRICING_TIERS.find((t) => t.credits === credits);
  return tier ?? VOLUME_PRICING_TIERS[0];
}

export function getDefaultTier(): PricingTier {
  return VOLUME_PRICING_TIERS[0];
}
