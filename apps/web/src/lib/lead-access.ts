import { db, type Prisma } from "@fine-leads/database";
import { type LeadTier } from "@fine-leads/utils";

/** MX-only checks are not SMTP deliverability verification. */
export const SMTP_VERIFIED_STATUSES = ["validated", "deliverable"];

export function leadInventoryWhere(tier: LeadTier): Prisma.AgentWhereInput {
  return tier === "PHONE_ONLY"
    ? { AND: [{ phone: { not: null } }, { phone: { not: "" } }] }
    : {
        isDeliverable: true,
        emailStatus: { in: SMTP_VERIFIED_STATUSES },
        AND: [{ email: { not: null } }, { email: { not: "" } }],
      };
}

interface EmailData {
  email?: string | null;
  emailStatus?: string | null;
  isDeliverable?: boolean | null;
}

/** Called at the server serialization boundary, not just in the UI. */
export function redactLeadForTier<T extends EmailData>(lead: T, tier: LeadTier) {
  const verified = tier === "VERIFIED_EMAIL" && lead.isDeliverable === true &&
    SMTP_VERIFIED_STATUSES.includes(lead.emailStatus ?? "") && Boolean(lead.email?.trim());
  if (tier !== "VERIFIED_EMAIL") {
    return {
      ...lead, email: null, emailStatus: null, isDeliverable: false,
      // These optional free-text fields can contain a duplicate email address.
      bio: null, socialProfiles: null, agentActivities: [], leadTier: tier,
    };
  }
  return {
    ...lead, email: verified ? lead.email ?? null : null,
    emailStatus: verified ? lead.emailStatus ?? null : null, isDeliverable: verified, leadTier: tier,
  };
}

/** Batch per-lead entitlements so purchasing one state cannot expose all emails. */
export async function getAgentLeadAccess(userId: string, agents: Array<{ id: string; state: string | null }>) {
  const access = new Map<string, LeadTier>();
  if (!agents.length) return access;
  const [unlocks, legacyPacks] = await Promise.all([
    db.unlockedLead.findMany({
      where: { userId, agentId: { in: agents.map((agent) => agent.id) }, purchase: { status: "COMPLETED" } },
      select: { agentId: true, purchase: { select: { tier: true } } },
    }),
    // Card/legacy state packs with no per-lead unlocks retain their old access.
    // New quantity orders always create unlockedLead rows and cannot use this path.
    db.leadPurchase.findMany({
      where: { userId, status: "COMPLETED", unlockedLeads: { none: {} } },
      select: { tier: true, unlockedStates: true },
    }),
  ]);
  for (const unlock of unlocks) access.set(unlock.agentId, unlock.purchase.tier);
  for (const agent of agents) {
    const packs = legacyPacks.filter((pack) => pack.unlockedStates.includes(agent.state?.toUpperCase() ?? ""));
    if (packs.some((pack) => pack.tier === "VERIFIED_EMAIL")) access.set(agent.id, "VERIFIED_EMAIL");
    else if (packs.length && !access.has(agent.id)) access.set(agent.id, "PHONE_ONLY");
  }
  return access;
}
