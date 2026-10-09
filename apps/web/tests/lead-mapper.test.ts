import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  query: vi.fn(),
  upsert: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@fine-leads/database", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@fine-leads/database")>();
  return { ...original, db: { $transaction: mocks.transaction } };
});
import {
  ingestLobstrLead,
  ingestLobstrLeads,
  mapLobstrLead,
  normalizePhone,
} from "../src/lib/scraper/lead-mapper";
const context = { state: "TX", city: "Austin", category: "real estate agents" };
const row = {
  Name: "Austin Realty",
  "Place Id": "place-1",
  Phone: "(512) 555-1234",
  Email: "SALES@EXAMPLE.COM",
  "State Code": "TX",
};
function mapped(record: Record<string, unknown> = row) {
  const result = mapLobstrLead(record, context);
  expect(result.kind).toBe("lead");
  if (result.kind !== "lead") throw new Error("Expected mapped lead");
  return result.lead;
}
beforeEach(() => {
  mocks.query.mockReset().mockResolvedValue([]);
  mocks.upsert.mockReset().mockResolvedValue({ id: "agent-1" });
  mocks.create.mockReset().mockResolvedValue({ id: "agent-1" });
  mocks.transaction
    .mockReset()
    .mockImplementation((callback) =>
      callback({
        $queryRaw: mocks.query,
        agent: { upsert: mocks.upsert, create: mocks.create },
      }),
    );
});

describe("Lobstr lead mapping", () => {
  it("maps contact, identity, address, rating, metadata and social fields", () => {
    const lead = mapped({
      ...row,
      "Additional Phone": "+1 512 555 5678",
      Website: "https://example.com",
      "Street Address": "1 Main St",
      City: "Austin",
      "Zip Code": "78701",
      Timezone: "America/Chicago",
      Category: "Real estate agency",
      Score: "4.8",
      Ratings: "42",
      "Reviews Link": "https://maps.google.com/reviews",
      Url: "https://maps.google.com/place/1",
      "Scraping Time": "2026-10-09T10:00:00Z",
      Cid: "13516245295286597923",
      Linkedin: "https://linkedin.com/company/example",
      Facebook: "https://facebook.com/example",
    });
    expect(lead.data).toMatchObject({
      fullName: "Austin Realty",
      brokerageName: "Austin Realty",
      googlePlaceId: "place-1",
      phone: "+15125551234",
      officePhone: "+15125555678",
      email: "sales@example.com",
      brokerageAddress: "1 Main St",
      state: "TX",
      city: "Austin",
      zipCode: "78701",
      rating: 4.8,
      reviewCount: 42,
      dataSource: "LOBSTR",
      scrapedAt: new Date("2026-10-09T10:00:00Z"),
    });
    expect(lead.data.socialProfiles).toMatchObject({
      linkedin: "https://linkedin.com/company/example",
      _lobstr: {
        cid: "13516245295286597923",
        reviewsLink: "https://maps.google.com/reviews",
      },
    });
  });
  it("accepts raw JSON snake_case labels and Name For Emails fallback", () => {
    expect(
      mapped({
        name_for_emails: "Austin Realty",
        place_id: "place-1",
        phone: "5125551234",
        state_code: "TX",
        street_address: "Main St",
        scraping_time: "2026-10-09 10:00:00.000000",
      }).data,
    ).toMatchObject({
      fullName: "Austin Realty",
      brokerageAddress: "Main St",
      scrapedAt: new Date("2026-10-09T10:00:00Z"),
    });
  });
  it.each([
    { "Is Permanently Closed": true },
    { is_temporarily_closed: true },
    { "Is Temporarily Closed": "true" },
    { is_permanently_closed: 1 },
  ])("discards closed records %j", (flags) => {
    expect(mapLobstrLead({ ...row, ...flags }, context).kind).toBe("closed");
  });
  it("does not treat string false as closed", () => {
    expect(
      mapLobstrLead({ ...row, is_permanently_closed: "false" }, context).kind,
    ).toBe("lead");
  });
  it.each([
    { country_code: "CA" },
    { "State Code": "CA" },
    { match_filters: false },
    { Name: "", "Name For Emails": "" },
    { "Place Id": "", Phone: "", Email: "invalid" },
  ])("rejects invalid/off-territory records %j", (changes) => {
    expect(mapLobstrLead({ ...row, ...changes }, context).kind).toBe("invalid");
  });
  it("does not claim SMTP deliverability from Lobstr valid/owner verified flags", () => {
    expect(
      mapped({
        ...row,
        email_status: "valid",
        email_verified_at: "2026-10-09T10:00:00Z",
        is_verified: true,
      }).data,
    ).toMatchObject({
      emailStatus: "unverified",
      isDeliverable: false,
      isVerified: false,
      lastVerifiedAt: null,
      verificationScore: 0,
    });
  });
  it("validates comma-separated emails and normalizes all dedup keys", () => {
    const lead = mapped({
      ...row,
      Email: "invalid, FIRST@EXAMPLE.COM; second@example.com",
    });
    expect(lead.data.email).toBe("first@example.com");
    expect(lead.emails).toEqual(["first@example.com", "second@example.com"]);
  });
  it("discards unsafe links and out-of-range ratings", () => {
    const data = mapped({
      ...row,
      Website: "javascript:alert(1)",
      Twitter: "https://secret:pass@example.com",
      Score: 10,
      Ratings: -1,
    }).data;
    expect(data.websiteUrl).toBeNull();
    expect(data.rating).toBeNull();
    expect(data.reviewCount).toBeNull();
    expect(data.socialProfiles).not.toHaveProperty("twitter");
  });
  it("falls back from placeholder names/addresses and does not turn missing ratings into zero", () => {
    expect(
      mapped({
        ...row,
        Name: "N/A",
        "Name For Emails": "Fallback Realty",
        "Street Address": "N/A",
        Address: "Main St",
        Score: "N/A",
      }).data,
    ).toMatchObject({
      fullName: "Fallback Realty",
      brokerageAddress: "Main St",
      rating: null,
    });
  });
  it("preserves string CID as a maps link when URL is absent", () => {
    expect(
      mapped({ ...row, Cid: "13516245295286597923" }).data.googleMapsLink,
    ).toBe("https://www.google.com/maps?cid=13516245295286597923");
  });
  it("normalizes phones without appending extension digits", () => {
    expect(normalizePhone("(512) 555-1234 ext. 99")).toBe("+15125551234");
    expect(normalizePhone("1-512-555-1234 x99")).toBe("+15125551234");
    expect(normalizePhone("1234")).toBeNull();
    expect(normalizePhone("+44 20 7946 0123")).toBeNull();
  });
});

describe("idempotent, atomic ingestion", () => {
  it("returns counters and never inserts closed/invalid rows", async () => {
    mocks.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "old" }]);
    const summary = await ingestLobstrLeads(
      [
        row,
        { ...row, "Place Id": "place-2" },
        { ...row, is_temporarily_closed: true },
        { Name: "" },
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
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });
  it.each(["place", "email", "formatted phone"])(
    "skips an existing %s match without downgrading it",
    async () => {
      mocks.query.mockResolvedValue([{ id: "verified-existing-agent" }]);
      const summary = await ingestLobstrLeads([row], context);
      expect(summary.duplicatesSkipped).toBe(1);
      expect(mocks.upsert).not.toHaveBeenCalled();
      expect(mocks.create).not.toHaveBeenCalled();
      const sql = mocks.query.mock.calls[0]![0];
      expect(sql.text).toContain('"googlePlaceId"');
      expect(sql.text).toContain('lower(trim("email"))');
      expect(sql.text).toContain('regexp_replace("phone"');
      expect(sql.values).toEqual(
        expect.arrayContaining(["place-1", "sales@example.com", "5125551234"]),
      );
    },
  );
  it("uses a Serializable transaction and a non-destructive place-ID upsert", async () => {
    await ingestLobstrLeads([row], context);
    expect(mocks.transaction.mock.calls[0]![1]).toMatchObject({
      isolationLevel: "Serializable",
    });
    expect(mocks.upsert.mock.calls[0]![0]).toMatchObject({
      where: { googlePlaceId: "place-1" },
      update: {},
    });
  });
  it("creates leads that have phone/email but no place ID", async () => {
    await ingestLobstrLeads([{ ...row, "Place Id": undefined }], context);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it.each(["P2034", "P2002"])(
    "rechecks after a concurrent %s conflict",
    async (code) => {
      mocks.transaction.mockRejectedValueOnce({ code });
      mocks.query.mockResolvedValue([{ id: "winner" }]);
      expect((await ingestLobstrLeads([row], context)).duplicatesSkipped).toBe(
        1,
      );
      expect(mocks.transaction).toHaveBeenCalledTimes(2);
    },
  );
  it("does not retry unrelated database failures", async () => {
    mocks.transaction.mockRejectedValue({ code: "P1001" });
    await expect(ingestLobstrLeads([row], context)).rejects.toEqual({
      code: "P1001",
    });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });
});

it("returns the existing Agent ID on a replay for order association", async () => {
  mocks.query.mockResolvedValue([{ id: "original-agent" }]);
  expect(await ingestLobstrLead(row, context)).toEqual({
    kind: "lead",
    agentId: "original-agent",
    created: false,
  });
  expect(mocks.upsert).not.toHaveBeenCalled();
});
