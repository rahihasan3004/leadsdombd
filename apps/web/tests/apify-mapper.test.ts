import { redactLeadForTier } from "@/lib/lead-access";
import { beforeEach, describe, expect, it, vi } from "vitest";
const { db } = vi.hoisted(() => ({
  db: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    agent: { upsert: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  },
}));
vi.mock("@fine-leads/database", async (original) => ({
  ...(await original<typeof import("@fine-leads/database")>()),
  db,
}));
import { mapApifyLead, ingestApifyLeads } from "@/lib/scraper/apify-mapper";
const context = { state: "MA", city: "Boston", category: "real estate agents" };
const record = {
  title: "Boston Realty",
  phoneUnformatted: "6175551234",
  address: "1 Main St",
  city: "Boston",
  state: "Massachusetts",
  postalCode: "02108",
  countryCode: "US",
  website: "https://example.com",
  emails: ["AGENT@example.com"],
  totalScore: 4.8,
  reviewsCount: 12,
  linkedin: "https://linkedin.com/company/example",
  facebooks: ["https://facebook.com/example"],
  instagram: "https://instagram.com/example",
  twitter: "https://x.com/example",
  placeId: "ChIJ_boston",
  url: "https://maps.google.com/place/test",
  scrapedAt: "2026-01-01T12:00:00Z",
};
beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(async (cb) => cb(db));
  db.$queryRaw.mockResolvedValue([]);
  db.agent.upsert.mockResolvedValue({ id: "a1" });
  db.agent.create.mockResolvedValue({ id: "a1" });
});
describe("Compass mapping and shared serializable deduplication", () => {
  it("preserves phone-only email and social redaction for Apify records", () => {
    const mapped = mapApifyLead(record, context);
    if (mapped.kind !== "lead") throw Error("mapping failed");
    const redacted = redactLeadForTier(
      {
        email: mapped.lead.data.email ?? null,
        socialProfiles: mapped.lead.data.socialProfiles,
        emailStatus: "unverified",
        isDeliverable: false,
      },
      "PHONE_ONLY",
    );
    expect(redacted.email).toBeNull();
    expect(redacted.socialProfiles).toBeNull();
  });

  it("maps native fields into the actual Agent schema without granting verified email", () => {
    const mapped = mapApifyLead(record, context);
    expect(mapped.kind).toBe("lead");
    if (mapped.kind !== "lead") throw Error("mapping failed");
    expect(mapped.lead.data).toMatchObject({
      fullName: "Boston Realty",
      brokerageAddress: "1 Main St",
      zipCode: "02108",
      state: "MA",
      phone: "+16175551234",
      email: "agent@example.com",
      rating: 4.8,
      reviewCount: 12,
      googlePlaceId: "ChIJ_boston",
      dataSource: "APIFY",
      isDeliverable: false,
      isVerified: false,
      emailStatus: "unverified",
      lastVerifiedAt: null,
      scrapedAt: new Date(record.scrapedAt),
    });
    expect(mapped.lead.data.socialProfiles).toMatchObject({
      linkedin: record.linkedin,
      facebook: record.facebooks[0],
      instagram: record.instagram,
      twitter: record.twitter,
    });
    expect(mapped.lead.data.socialProfiles).not.toHaveProperty("_lobstr");
  });
  it.each([
    "isClosed",
    "permanentlyClosed",
    "isPermanentlyClosed",
    "temporarilyClosed",
  ])("discards closed places marked %s", (field) => {
    expect(mapApifyLead({ ...record, [field]: true }, context)).toEqual({
      kind: "closed",
    });
  });
  it("preserves/reconstructs leading zero ZIPs and normalizes formatted phones", () => {
    const mapped = mapApifyLead(
      {
        ...record,
        postalCode: 2108,
        phoneUnformatted: "invalid",
        phone: "(617) 555-1234",
      },
      context,
    );
    if (mapped.kind !== "lead") throw Error("mapping failed");
    expect(mapped.lead.data.zipCode).toBe("02108");
    expect(mapped.lead.data.phone).toBe("+16175551234");
  });
  it("discards wrong-state and non-US results", () => {
    expect(mapApifyLead({ ...record, state: "TX" }, context).kind).toBe(
      "invalid",
    );
    expect(mapApifyLead({ ...record, countryCode: "CA" }, context).kind).toBe(
      "invalid",
    );
  });
  it("rejects unsafe profile/website URLs and places with no stable identity", () => {
    const mapped = mapApifyLead(
      {
        ...record,
        website: "javascript:alert(1)",
        linkedin: "https://user:password@example.com",
      },
      context,
    );
    if (mapped.kind !== "lead") throw Error("mapping failed");
    expect(mapped.lead.data.websiteUrl).toBeNull();
    expect(mapped.lead.data.socialProfiles).not.toHaveProperty("linkedin");
    expect(
      mapApifyLead({ title: "No identity", state: "MA" }, context).kind,
    ).toBe("invalid");
  });
  it("skips an existing place/email/phone without downgrading its verified data", async () => {
    db.$queryRaw.mockResolvedValue([{ id: "existing" }]);
    const summary = await ingestApifyLeads([record], context);
    expect(summary).toMatchObject({ duplicatesSkipped: 1, newlyIngested: 0 });
    expect(db.agent.upsert).not.toHaveBeenCalled();
    const query = db.$queryRaw.mock.calls[0]![0];
    expect(query.sql).toContain("googlePlaceId");
    expect(query.sql).toContain("email");
    expect(query.sql).toContain("officePhone");
    expect(db.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: "Serializable" }),
    );
  });
  it("returns exact inserted, duplicate, closed and invalid counters", async () => {
    db.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "existing" }]);
    const summary = await ingestApifyLeads(
      [
        record,
        record,
        { ...record, isClosed: true },
        { title: "Invalid", state: "MA" },
      ],
      context,
    );
    expect(summary).toEqual({
      totalFetched: 4,
      newlyIngested: 1,
      duplicatesSkipped: 1,
      closedPlacesDiscarded: 1,
      invalidRecordsDiscarded: 1,
    });
  });
});

it("persists syntax/domain eligibility during Apify ingestion without SMTP verification", async () => {
  await ingestApifyLeads([record], context);
  expect(db.agent.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      create: expect.objectContaining({
        emailStatus: "syntax_valid",
        isDeliverable: true,
        isVerified: false,
        lastVerifiedAt: null,
      }),
    }),
  );
});
it("reconnects historical duplicate email evidence only using guarded updates", async () => {
  db.$queryRaw.mockResolvedValue([{ id: "existing" }]);
  await ingestApifyLeads([record], context);
  expect(db.agent.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        id: "existing",
        email: "agent@example.com",
        dataSource: "APIFY",
      }),
      data: expect.objectContaining({
        emailStatus: "syntax_valid",
        isVerified: false,
      }),
    }),
  );
});
