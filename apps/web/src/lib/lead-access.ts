import { db, type Prisma } from "@fine-leads/database";
import { type LeadTier } from "@fine-leads/utils";
import {
  normalizeSocialProfiles,
  socialProfileKey,
  isSocialContainer,
  safeSocialUrl,
  stripSocialLinks,
} from "./lead-profiles";

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
  socialProfiles?: unknown;
}

/** Called at the server serialization boundary, not just in the UI. */
export function redactLeadForTier<T extends EmailData>(
  lead: T,
  tier: LeadTier,
) {
  const verified =
    tier === "VERIFIED_EMAIL" &&
    lead.isDeliverable === true &&
    SMTP_VERIFIED_STATUSES.includes(lead.emailStatus ?? "") &&
    Boolean(lead.email?.trim());
  const profiles = normalizeSocialProfiles(
    lead.socialProfiles,
    ...Object.entries(lead)
      .filter(([key]) => isSocialContainer(key) && key !== "socialProfiles")
      .map(([, value]) => value),
    lead,
  );
  // Handle both the canonical JSON container and historical flattened profile aliases.
  const profileFields = Object.fromEntries(
    Object.entries(lead).flatMap<[string, unknown]>(([key, value]) => {
      if (socialProfileKey(key))
        return [[key, tier === "VERIFIED_EMAIL" ? safeSocialUrl(value) : null]];
      if (isSocialContainer(key))
        return [
          [
            key,
            tier === "VERIFIED_EMAIL" ? normalizeSocialProfiles(value) : null,
          ],
        ];
      if (tier !== "VERIFIED_EMAIL" && typeof value === "string")
        return [[key, stripSocialLinks(value, profiles)]];
      return [];
    }),
  );
  if (tier !== "VERIFIED_EMAIL") {
    return {
      ...lead,
      ...profileFields,
      email: null,
      emailStatus: null,
      isDeliverable: false,
      // Phone packs cannot expose enrichment or duplicate contact/profile text.
      bio: null,
      socialProfiles: null,
      agentActivities: [],
      leadTier: tier,
    };
  }
  return {
    ...lead,
    ...profileFields,
    email: verified ? (lead.email ?? null) : null,
    emailStatus: verified ? (lead.emailStatus ?? null) : null,
    isDeliverable: verified,
    socialProfiles: profiles,
    leadTier: tier,
  };
}

/** Batch per-lead entitlements so purchasing one state cannot expose all emails. */
export async function getAgentLeadAccess(
  userId: string,
  agents: Array<{ id: string; state: string | null }>,
) {
  const access = new Map<string, LeadTier>();
  if (!agents.length) return access;
  const unlocks = await db.unlockedLead.findMany({
    where: {
      userId,
      agentId: { in: agents.map((agent) => agent.id) },
      purchase: { userId, status: "COMPLETED" },
    },
    select: { agentId: true, purchase: { select: { tier: true } } },
  });
  // No subscription or zero-unlock state-pack fallback. A quantity is not a license.
  for (const unlock of unlocks)
    access.set(unlock.agentId, unlock.purchase.tier);
  return access;
}
