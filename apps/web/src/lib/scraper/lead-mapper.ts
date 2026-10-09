import { db, Prisma } from "@fine-leads/database";
import { z } from "zod";
import type { LobstrRecord } from "./lobstr-client";

export interface LeadContext {
  state: string;
  city?: string;
  category: string;
}
export interface MappedLead {
  data: Prisma.AgentCreateInput;
  emails: string[];
  phones: string[];
}
export type MappingResult =
  { kind: "lead"; lead: MappedLead } | { kind: "closed" } | { kind: "invalid" };
export interface IngestionSummary {
  totalFetched: number;
  duplicatesSkipped: number;
  closedPlacesDiscarded: number;
  invalidRecordsDiscarded: number;
  newlyIngested: number;
}

const text = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result && !/^(n\/a|null|undefined|none|-)$/i.test(result)
    ? result.slice(0, 2000)
    : null;
};
const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
function fields(record: LobstrRecord) {
  const normalized = new Map(
    Object.entries(record).map(([name, value]) => [key(name), value]),
  );
  return (...names: string[]): unknown => {
    for (const name of names) {
      const value = normalized.get(key(name));
      if (value !== null && value !== undefined && value !== "") return value;
    }
    return undefined;
  };
}
const isTrue = (value: unknown) =>
  value === true ||
  value === 1 ||
  (typeof value === "string" && /^(true|yes|1)$/i.test(value.trim()));
function url(value: unknown): string | null {
  const first = text(value)?.split(/[,\s]+/)[0];
  if (!first) return null;
  try {
    const parsed = new URL(first);
    return ["https:", "http:"].includes(parsed.protocol) &&
      !parsed.username &&
      !parsed.password
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}
export function normalizePhone(value: unknown): string | null {
  const raw = text(value)?.replace(/\s*(?:ext\.?|x|#)\s*\d+.*$/i, "");
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}
function number(value: unknown, max: number, integer = false): number | null {
  if (value === undefined || value === null || value === "") return null;
  const raw = typeof value === "number" ? value : text(value);
  if (raw === null) return null;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(parsed) &&
    parsed >= 0 &&
    parsed <= max &&
    (!integer || Number.isInteger(parsed))
    ? parsed
    : null;
}
function timestamp(value: unknown): Date | null {
  const raw = text(value);
  if (!raw || !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(raw)) return null;
  const normalized = raw.replace(" ", "T");
  const date = new Date(
    /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Handles Lobstr JSON snake_case and its exported human-readable CSV labels. */
export function mapLobstrLead(
  record: LobstrRecord,
  context: LeadContext,
): MappingResult {
  const get = fields(record);
  if (
    isTrue(get("Is Permanently Closed")) ||
    isTrue(get("Is Temporarily Closed"))
  )
    return { kind: "closed" };
  if (get("match_filters") === false) return { kind: "invalid" };
  const country = text(get("country_code"));
  const state = text(get("State Code"))?.toUpperCase() ?? context.state;
  if ((country && country.toUpperCase() !== "US") || state !== context.state)
    return { kind: "invalid" };
  const fullName = text(get("Name")) ?? text(get("Name For Emails"));
  const googlePlaceId = text(get("Place Id"));
  const emails = [
    ...new Set(
      (text(get("Email")) ?? "")
        .split(/[,;\s]+/)
        .map((email) => email.toLowerCase())
        .filter((email) => z.string().email().safeParse(email).success),
    ),
  ];
  const phone = normalizePhone(get("Phone"));
  const officePhone = normalizePhone(get("Additional Phone"));
  if (!fullName || (!googlePlaceId && !phone && emails.length === 0))
    return { kind: "invalid" };
  const profiles: Record<string, Prisma.InputJsonValue | null> = {};
  for (const name of [
    "Linkedin",
    "Facebook",
    "Instagram",
    "Twitter",
    "Tiktok",
    "Whatsapp",
    "Youtube",
    "Pinterest",
  ]) {
    const profile = url(get(name));
    if (profile) profiles[name.toLowerCase()] = profile;
  }
  // The current Agent schema has no CID/reviews-link columns; preserve source metadata in JSON.
  const cid = text(get("Cid")); // Never coerce Google's 64-bit CID through a JS number.
  profiles._lobstr = {
    cid,
    reviewsLink: url(get("Reviews Link")),
    nameForEmails: text(get("Name For Emails")),
    sourceEmailStatus: text(get("email_status")),
    sourceEmailVerifiedAt: text(get("email_verified_at")),
  };
  const category = text(get("Category")) ?? context.category;
  return {
    kind: "lead",
    lead: {
      emails,
      phones: [
        ...new Set(
          [phone, officePhone].filter((item): item is string => item !== null),
        ),
      ],
      data: {
        fullName,
        brokerageName: fullName,
        email: emails[0] ?? null,
        phone,
        officePhone,
        websiteUrl: url(get("Website")),
        brokerageAddress: text(get("Street Address")) ?? text(get("Address")),
        city: text(get("City")) ?? context.city,
        state,
        zipCode: text(get("Zip Code")),
        timezone: text(get("Timezone")),
        county: text(get("County")),
        category,
        googleMainCategory: category.split(",")[0]?.trim() ?? category,
        googleSubcategories: category.includes(",")
          ? category.split(",").slice(1).join(",").trim()
          : null,
        rating: number(get("Score"), 5),
        reviewCount: number(
          get("Ratings", "Review Count"),
          2_147_483_647,
          true,
        ),
        googlePlaceId,
        googleMapsLink:
          url(get("Url")) ??
          (cid
            ? `https://www.google.com/maps?cid=${encodeURIComponent(cid)}`
            : null),
        scrapedAt: timestamp(get("Scraping Time")),
        socialProfiles: profiles,
        dataSource: "LOBSTR",
        propertyTypes: [],
        specializations: [],
        // Lobstr's "valid" email / claimed Google listing is NOT proof of SMTP deliverability.
        emailStatus: emails.length ? "unverified" : null,
        isDeliverable: false,
        isVerified: false,
        verificationScore: 0,
        lastVerifiedAt: null,
      },
    },
  };
}

async function insertUnlessDuplicate(
  lead: MappedLead,
): Promise<{ id: string; created: boolean }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const conditions: Prisma.Sql[] = [];
          if (lead.data.googlePlaceId)
            conditions.push(
              Prisma.sql`"googlePlaceId" = ${lead.data.googlePlaceId}`,
            );
          if (lead.emails.length)
            conditions.push(
              Prisma.sql`lower(trim("email")) IN (${Prisma.join(lead.emails)})`,
            );
          if (lead.phones.length) {
            // Match historical formatted US numbers, not just freshly normalized E.164 numbers.
            const phones = lead.phones.map((phone) => phone.slice(-10));
            conditions.push(
              Prisma.sql`right(regexp_replace(regexp_replace("phone", '[[:space:]]*(ext\\.?|x|#).*$', '', 'i'), '[^0-9]', '', 'g'), 10) IN (${Prisma.join(phones)})`,
            );
          }
          const existing = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT "id" FROM "Agent" WHERE ${Prisma.join(conditions, " OR ")} LIMIT 1
        `);
          if (existing[0]) return { id: existing[0].id, created: false }; // Never downgrade existing verified Agents.
          let saved: { id: string };
          if (lead.data.googlePlaceId) {
            saved = await tx.agent.upsert({
              where: { googlePlaceId: lead.data.googlePlaceId },
              create: lead.data,
              update: {},
              select: { id: true },
            });
          } else {
            saved = await tx.agent.create({
              data: lead.data,
              select: { id: true },
            });
          }
          return { id: saved.id, created: true };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 10_000,
        },
      );
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? error.code
          : undefined;
      // PostgreSQL SSI prevents concurrent email/phone write-skew; recheck after a conflict.
      if ((code !== "P2034" && code !== "P2002") || attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** attempt));
    }
  }
  throw new Error("Unable to ingest lead after transaction retries");
}

export async function ingestLobstrLeads(
  records: LobstrRecord[],
  context: LeadContext,
): Promise<IngestionSummary> {
  const summary: IngestionSummary = {
    totalFetched: records.length,
    duplicatesSkipped: 0,
    closedPlacesDiscarded: 0,
    invalidRecordsDiscarded: 0,
    newlyIngested: 0,
  };
  for (const record of records) {
    const mapped = mapLobstrLead(record, context);
    if (mapped.kind === "closed") summary.closedPlacesDiscarded++;
    else if (mapped.kind === "invalid") summary.invalidRecordsDiscarded++;
    else if ((await insertUnlessDuplicate(mapped.lead)).created)
      summary.newlyIngested++;
    else summary.duplicatesSkipped++;
  }
  return summary;
}

/** Returns existing IDs too, so a replay reconnects a deduplicated lead to its order. */
export async function ingestLobstrLead(
  record: LobstrRecord,
  context: LeadContext,
) {
  const mapped = mapLobstrLead(record, context);
  if (mapped.kind !== "lead") return { kind: mapped.kind };
  const saved = await insertUnlessDuplicate(mapped.lead);
  return { kind: "lead" as const, agentId: saved.id, created: saved.created };
}
