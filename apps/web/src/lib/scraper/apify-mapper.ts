import {
  validateApifyEmail,
  validateExistingApifyEmail,
} from "./apify-email-validator";
import type { Prisma } from "@fine-leads/database";
import { US_STATES } from "@fine-leads/utils";
import {
  mapLobstrLead,
  normalizePhone,
  insertUnlessDuplicate,
  type LeadContext,
  type MappingResult,
  type IngestionSummary,
} from "./lead-mapper";
import type { CompassRecord } from "./apify-client";

const first = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.find((item) => typeof item === "string" && item.trim())
    : value;
const closed = (value: unknown) =>
  value === true ||
  value === 1 ||
  (typeof value === "string" && /^(true|yes|1)$/i.test(value.trim()));
export function mapApifyLead(
  record: CompassRecord,
  context: LeadContext,
): MappingResult {
  if (
    [
      record.isClosed,
      record.permanentlyClosed,
      record.isPermanentlyClosed,
      record.temporarilyClosed,
    ].some(closed)
  )
    return { kind: "closed" };
  const rawState =
    typeof record.state === "string" ? record.state.trim() : context.state;
  const state = US_STATES.find(
    (item) =>
      item.code === rawState.toUpperCase() ||
      item.name.toLowerCase() === rawState.toLowerCase(),
  )?.code;
  if (!state || state !== context.state) return { kind: "invalid" };
  const zip =
    typeof record.postalCode === "string"
      ? record.postalCode.trim()
      : typeof record.postalCode === "number" &&
          Number.isInteger(record.postalCode) &&
          record.postalCode >= 0 &&
          record.postalCode <= 99999
        ? String(record.postalCode).padStart(5, "0")
        : null;
  const result = mapLobstrLead(
    {
      Name: record.title,
      Phone:
        normalizePhone(first(record.phoneUnformatted)) ??
        normalizePhone(first(record.phone)),
      Email: Array.isArray(record.emails)
        ? record.emails
            .filter((item): item is string => typeof item === "string")
            .join(",")
        : first(record.email),
      Address: record.address,
      City: record.city,
      "State Code": state,
      "Zip Code": zip,
      Website: record.website,
      Score: record.totalScore,
      Ratings: record.reviewsCount,
      "Place Id": record.placeId,
      Url: record.url,
      "Scraping Time": record.scrapedAt ?? new Date().toISOString(),
      Category:
        record.categoryName ?? first(record.categories) ?? context.category,
      country_code: record.countryCode,
      Linkedin: first(record.linkedin) ?? first(record.linkedIns),
      Facebook: first(record.facebook) ?? first(record.facebooks),
      Instagram: first(record.instagram) ?? first(record.instagrams),
      Twitter: first(record.twitter) ?? first(record.twitters),
      Whatsapp: first(record.whatsapp),
    },
    context,
  );
  if (result.kind === "lead") {
    result.lead.data.dataSource = "APIFY";
    // Mapping alone never claims verification; ingestion applies the configured staged validator.
    const profiles = result.lead.data.socialProfiles;
    if (profiles && typeof profiles === "object" && !Array.isArray(profiles)) {
      const cleanProfiles: Record<string, Prisma.InputJsonValue | null> = {};
      for (const [key, value] of Object.entries(
        profiles as Prisma.InputJsonObject,
      )) {
        if (key !== "_lobstr" && value !== undefined)
          cleanProfiles[key] = value;
      }
      cleanProfiles._apify = { actor: "compass/crawler-google-places" };
      result.lead.data.socialProfiles = cleanProfiles;
    }
  }
  return result;
}
export async function ingestApifyLead(
  record: CompassRecord,
  context: LeadContext,
) {
  const mapped = mapApifyLead(record, context);
  if (mapped.kind !== "lead") return { kind: mapped.kind };
  const email = mapped.lead.data.email;
  if (typeof email === "string" && email) {
    const validation = await validateApifyEmail(email);
    Object.assign(mapped.lead.data, {
      emailStatus: validation.status,
      isDeliverable: validation.eligible,
      isVerified: validation.verified,
      verificationScore: validation.verified ? 100 : 0,
      lastVerifiedAt: validation.verified ? new Date() : null,
    });
  }
  const saved = await insertUnlessDuplicate(mapped.lead);
  // Reconnect old APIFY duplicates without blessing a different email/source or hard failure.
  if (!saved.created && typeof email === "string" && email)
    await validateExistingApifyEmail(saved.id, email, {
      status:
        typeof mapped.lead.data.emailStatus === "string"
          ? mapped.lead.data.emailStatus
          : "unverified",
      eligible: mapped.lead.data.isDeliverable === true,
      verified: mapped.lead.data.isVerified === true,
    });
  return {
    kind: "lead" as const,
    agentId: saved.id,
    created: saved.created,
    eligible: mapped.lead.data.isDeliverable === true,
  };
}
export async function ingestApifyLeads(
  records: CompassRecord[],
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
    const result = await ingestApifyLead(record, context);
    if (result.kind === "closed") summary.closedPlacesDiscarded++;
    else if (result.kind === "invalid") summary.invalidRecordsDiscarded++;
    else if (result.created) summary.newlyIngested++;
    else summary.duplicatesSkipped++;
  }
  return summary;
}
