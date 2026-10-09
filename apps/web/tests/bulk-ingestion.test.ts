import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  transaction: vi.fn(),
  raw: vi.fn(),
  createMany: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@fine-leads/database", async (original) => ({
  ...(await original<typeof import("@fine-leads/database")>()),
  db: { $transaction: m.transaction },
}));
import { ingestLobstrPages } from "../src/lib/scraper/bulk-ingestion";
import { Prisma } from "@fine-leads/database";
const tx = {
  $queryRaw: m.raw,
  agent: {
    createMany: m.createMany,
    findMany: m.findMany,
    create: m.create,
    update: m.update,
  },
};
const context = { state: "TX", category: "real estate agents" };
const lead = (index = 1) => ({
  Name: `Test Agent ${index}`,
  "Place Id": `test-place-${index}`,
  Phone: `512555${String(index).padStart(4, "0")}`,
  Email: `agent${index}@example.com`,
  "State Code": "TX",
});
beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset();
  m.transaction.mockImplementation(async (callback) => callback(tx));
  m.raw.mockResolvedValue([]);
  m.createMany.mockImplementation(async ({ data }) => ({ count: data.length }));
  m.findMany.mockImplementation(async ({ where }) =>
    where.id.in.map((id: string) => ({ id })),
  );
});
afterEach(() => vi.restoreAllMocks());
describe("serializable bulk ingestion", () => {
  it("uses one bulk write, not per-lead insertion, for 100 distinct records", async () => {
    const result = await ingestLobstrPages([
      { records: Array.from({ length: 100 }, (_, i) => lead(i + 1)), context },
    ]);
    expect(result.newlyIngested).toBe(100);
    expect(result.agentIds).toHaveLength(100);
    expect(m.raw).toHaveBeenCalledOnce();
    expect(m.createMany).toHaveBeenCalledOnce();
    expect(m.createMany.mock.calls[0]![0].skipDuplicates).toBe(true);
    expect(m.create).not.toHaveBeenCalled();
    expect(m.transaction.mock.calls[0]![1]).toMatchObject({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });
  it("deduplicates repeated place IDs and reconnects all source pages to the same ID", async () => {
    const result = await ingestLobstrPages([
      {
        records: [lead(), { ...lead(), Email: "another@example.com" }],
        context,
      },
      { records: [lead()], context },
    ]);
    expect(result.newlyIngested).toBe(1);
    expect(result.duplicatesSkipped).toBe(2);
    expect(result.pageAgentIds[0]).toEqual(result.pageAgentIds[1]);
  });
  it("deduplicates phone and email collisions even when place IDs differ", async () => {
    const result = await ingestLobstrPages([
      {
        records: [
          lead(),
          { ...lead(2), Phone: lead().Phone },
          { ...lead(3), Email: lead().Email },
        ],
        context,
      },
    ]);
    expect(result.newlyIngested).toBe(1);
    expect(result.agentIds).toHaveLength(1);
  });
  it("matches historical normalized office phones and preserves existing verified rows", async () => {
    m.raw.mockResolvedValue([
      {
        id: "existing",
        googlePlaceId: null,
        emailKey: null,
        phoneKey: null,
        officePhoneKey: "5125550001",
      },
    ]);
    const result = await ingestLobstrPages([{ records: [lead()], context }]);
    expect(result.agentIds).toEqual(["existing"]);
    expect(result.newlyIngested).toBe(0);
    expect(m.createMany).not.toHaveBeenCalled();
    expect(m.update).not.toHaveBeenCalled();
    expect(m.raw.mock.calls[0]![0].sql).toContain('"officePhone"');
  });
  it("prefers exact place identity over an unrelated existing shared contact", async () => {
    m.raw.mockResolvedValue([
      {
        id: "contact",
        googlePlaceId: "other-place",
        emailKey: "agent1@example.com",
        phoneKey: null,
        officePhoneKey: null,
      },
      {
        id: "place",
        googlePlaceId: "test-place-1",
        emailKey: "other@example.com",
        phoneKey: null,
        officePhoneKey: null,
      },
    ]);
    expect(
      (await ingestLobstrPages([{ records: [lead()], context }])).agentIds,
    ).toEqual(["place"]);
  });
  it("discards closed and invalid rows but still commits empty-page checkpoints", async () => {
    const commit = vi.fn();
    const result = await ingestLobstrPages(
      [
        {
          records: [{ ...lead(), "Is Temporarily Closed": true }, {}],
          context,
        },
      ],
      commit,
    );
    expect(result.closedPlacesDiscarded).toBe(1);
    expect(result.invalidRecordsDiscarded).toBe(1);
    expect(result.agentIds).toEqual([]);
    expect(commit).toHaveBeenCalledOnce();
    expect(m.createMany).not.toHaveBeenCalled();
  });
  it("runs lease guard, candidate links, and page cursor in the same transaction", async () => {
    const events: string[] = [];
    const guard = vi.fn(async (actual) => {
      expect(actual).toBe(tx);
      events.push("guard");
    });
    const commit = vi.fn(async (actual, result) => {
      expect(actual).toBe(tx);
      expect(result.agentIds).toHaveLength(1);
      events.push("commit");
    });
    await ingestLobstrPages([{ records: [lead()], context }], commit, guard);
    expect(events).toEqual(["guard", "commit"]);
  });
  it("retries serialization conflicts rather than dropping a page", async () => {
    m.transaction.mockRejectedValueOnce({ code: "P2034" });
    expect(
      (await ingestLobstrPages([{ records: [lead()], context }])).newlyIngested,
    ).toBe(1);
    expect(m.transaction).toHaveBeenCalledTimes(2);
  });
  it("never publishes candidate IDs that were skipped by a unique conflict", async () => {
    m.findMany.mockResolvedValue([]);
    const commit = vi.fn();
    await expect(
      ingestLobstrPages([{ records: [lead()], context }], commit),
    ).rejects.toThrow("BULK_IDENTITY_CONFLICT");
    expect(m.transaction).toHaveBeenCalledTimes(4);
    expect(commit).not.toHaveBeenCalled();
  });
  it("does not commit progress after a lost parent lease", async () => {
    const commit = vi.fn();
    const guard = vi.fn().mockRejectedValue(new Error("lease lost"));
    await expect(
      ingestLobstrPages([{ records: [lead()], context }], commit, guard),
    ).rejects.toThrow("lease lost");
    expect(m.raw).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });
  it("bounds memory and SQL bind growth to ten fixed-size pages", async () => {
    await expect(
      ingestLobstrPages([
        { records: Array.from({ length: 1001 }, () => lead()), context },
      ]),
    ).rejects.toThrow("bounded page limit");
    expect(m.transaction).not.toHaveBeenCalled();
  });
});
