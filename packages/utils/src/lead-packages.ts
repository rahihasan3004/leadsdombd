/** Lead package identifiers sent by Search Leads to the order API. */
export type LeadTier = "PHONE_ONLY" | "VERIFIED_EMAIL";

export const LEAD_PACKAGES = [
  {
    tier: "PHONE_ONLY",
    name: "Cold Calling Pack",
    creditsPerLead: 1,
    description: "Direct Phone, Brokerage, Address & Google Place details (No email included).",
    recommended: false,
  },
  {
    tier: "VERIFIED_EMAIL",
    name: "Full Outreach Pack",
    creditsPerLead: 2,
    description: "17 Guaranteed Fields + 100% SMTP Deliverable Verified Email.",
    recommended: true,
  },
] as const;

export function getLeadCreditCost(quantity: number, tier: LeadTier): number {
  return quantity * (tier === "VERIFIED_EMAIL" ? 2 : 1);
}
