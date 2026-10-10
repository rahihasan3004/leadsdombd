import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  raw: vi.fn(),
  insert: vi.fn(),
  present: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  validate: vi.fn(),
}));
vi.mock("@fine-leads/database", async (original) => ({
  ...(await original<typeof import("@fine-leads/database")>()),
  db: { $transaction: m.transaction },
}));
vi.mock("@/lib/scraper/apify-email-validator", () => ({
  validateApifyEmail: m.validate,
  validateExistingApifyEmail: vi.fn(),
}));
import { ingestApifyPages } from "@/lib/scraper/apify-mapper";
import { Prisma } from "@fine-leads/database";
const tx = {
  $queryRaw: m.raw,
  agent: { createMany: m.insert, findMany: m.present, updateMany: m.update },
};
const context = { state: "DE", category: "real estate agents" };
const record = (i: number) => ({
  title: `Agent ${i}`,
  state: "Delaware",
  countryCode: "US",
  phoneUnformatted: `+1302555${String(i).padStart(4, "0")}`,
  postalCode: "01901",
  placeId: `place-${i}`,
  totalScore: 5,
  reviewsCount: 290,
});
beforeEach(() => {
  vi.resetAllMocks();
  m.transaction.mockImplementation(async (cb) => cb(tx));
  m.raw.mockResolvedValue([]);
  m.insert.mockImplementation(async ({ data }) => ({ count: data.length }));
  m.present.mockImplementation(async ({ where }) =>
    where.id.in.map((id: string) => ({ id })),
  );
  m.validate.mockResolvedValue({
    status: "syntax_valid",
    eligible: true,
    verified: false,
  });
});
describe("atomic Compass page ingestion", () => {
  it("ingests 100 phone leads in one SSI transaction and one bulk write, without email work", async () => {
    const commit = vi.fn(),
      guard = vi.fn();
    const result = await ingestApifyPages(
      [{ records: Array.from({ length: 100 }, (_, i) => record(i)), context }],
      commit,
      guard,
    );
    expect(result.newlyIngested).toBe(100);
    expect(result.agentIds).toHaveLength(100);
    expect(m.transaction).toHaveBeenCalledOnce();
    expect(m.raw).toHaveBeenCalledOnce();
    expect(m.insert).toHaveBeenCalledOnce();
    expect(m.validate).not.toHaveBeenCalled();
    expect(m.update).not.toHaveBeenCalled();
    expect(commit).toHaveBeenCalledWith(tx, result);
    expect(guard).toHaveBeenCalledBefore(m.insert);
    expect(m.transaction.mock.calls[0]![1]).toMatchObject({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(m.insert.mock.calls[0]![0].data[0]).toMatchObject({
      state: "DE",
      zipCode: "01901",
      rating: 5,
      reviewCount: 290,
      dataSource: "APIFY",
    });
  });
  it("reconciles replay, within-page duplicate contacts, and closed/wrong-state records", async () => {
    m.raw.mockResolvedValue([
      {
        id: "existing",
        googlePlaceId: "place-1",
        emailKey: null,
        phoneKey: "3025550001",
        officePhoneKey: null,
      },
    ]);
    const result = await ingestApifyPages([
      {
        records: [
          record(1),
          { ...record(2), phoneUnformatted: record(1).phoneUnformatted },
          { ...record(3), permanentlyClosed: true },
          { ...record(4), state: "Texas" },
        ],
        context,
      },
    ]);
    expect(result).toMatchObject({
      agentIds: ["existing"],
      newlyIngested: 0,
      duplicatesSkipped: 2,
      closedPlacesDiscarded: 1,
      invalidRecordsDiscarded: 1,
    });
    expect(m.insert).not.toHaveBeenCalled();
  });
  it("aborts writes/cursor publication on a lost lease", async () => {
    const commit = vi.fn();
    await expect(
      ingestApifyPages(
        [{ records: [record(1)], context }],
        commit,
        async () => {
          throw Error("lease lost");
        },
      ),
    ).rejects.toThrow("lease lost");
    expect(m.insert).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });
  it("retries SSI conflicts and reconnects to winning identities", async () => {
    m.transaction.mockRejectedValueOnce({ code: "P2034" });
    expect(
      (await ingestApifyPages([{ records: [record(1)], context }]))
        .newlyIngested,
    ).toBe(1);
    expect(m.transaction).toHaveBeenCalledTimes(2);
  });
  it("validates each unique email once and refreshes staged duplicates with source/address CAS", async () => {
    await ingestApifyPages([
      {
        records: [
          { ...record(1), email: "agent@example.com" },
          { ...record(2), email: "agent@example.com" },
        ],
        context,
      },
    ]);
    expect(m.validate).toHaveBeenCalledOnce();
    expect(m.insert.mock.calls[0]![0].data).toHaveLength(1);
    expect(m.update).toHaveBeenCalledOnce();
    expect(m.update.mock.calls[0]![0]).toMatchObject({
      where: {
        dataSource: "APIFY",
        email: { in: ["agent@example.com"] },
        OR: [
          { emailStatus: null },
          {
            emailStatus: {
              in: ["unverified", "unknown", "syntax_valid", "mx_valid"],
            },
          },
        ],
      },
      data: {
        emailStatus: "syntax_valid",
        isVerified: false,
        isDeliverable: true,
      },
    });
  });
  it("does not write or commit when validation fails", async () => {
    m.validate.mockRejectedValue(Error("validator unavailable"));
    const commit = vi.fn();
    await expect(
      ingestApifyPages(
        [{ records: [{ ...record(1), email: "agent@example.com" }], context }],
        commit,
      ),
    ).rejects.toThrow("validator unavailable");
    expect(m.transaction).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });
});
