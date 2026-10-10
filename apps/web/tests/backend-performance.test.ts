import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, dbMock, cacheMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  dbMock: {
    leadPurchase: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
    unlockedLead: { findMany: vi.fn(), count: vi.fn() },
    agent: { groupBy: vi.fn() },
    $queryRaw: vi.fn(),
  },
  cacheMock: vi.fn(),
}));
vi.mock("@fine-leads/auth", () => ({ auth: authMock }));
vi.mock("@fine-leads/database", () => ({ db: dbMock }));
vi.mock("@fine-leads/utils/redis-cache", () => ({
  cachedAggregate: cacheMock,
}));

import { GET as purchasesGET } from "../app/api/purchases/route";
import { GET as statsGET } from "../app/api/leads/stats/route";
import {
  getMonthlyLeadCounts,
  getScraperDailyCounts,
} from "@/lib/lead-aggregates";

beforeEach(() => {
  vi.resetAllMocks();
  authMock.mockResolvedValue({ user: { id: "user-1" } });
  dbMock.leadPurchase.findMany.mockResolvedValue([]);
  dbMock.leadPurchase.count.mockResolvedValue(0);
  dbMock.agent.groupBy.mockResolvedValue([]);
  dbMock.unlockedLead.count.mockResolvedValue(1);
  dbMock.unlockedLead.findMany.mockResolvedValue([
    { agent: { id: "agent-1", fullName: "Agent" } },
  ]);
  cacheMock.mockImplementation((_key, _ttl, load) => load());
  dbMock.$queryRaw.mockResolvedValue([]);
});

const request = (query = "") =>
  new Request(`https://app.test/api/purchases?${query}`);

describe("bounded purchase summaries", () => {
  it("selects only summaries and counts, never individual unlocked leads", async () => {
    const response = await purchasesGET(request("view=orders&page=2&limit=10"));
    expect(response.status).toBe(200);
    expect(dbMock.leadPurchase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        where: {
          userId: "user-1",
          status: { in: ["COMPLETED", "PROCESSING", "REFUNDED", "FAILED"] },
        },
        select: expect.objectContaining({
          _count: { select: { unlockedLeads: true } },
        }),
      }),
    );
    const query = dbMock.leadPurchase.findMany.mock.calls[0][0];
    expect(query.include).toBeUndefined();
    expect(query.select.unlockedLeads).toBeUndefined();
    expect(dbMock.unlockedLead.findMany).not.toHaveBeenCalled();
  });

  it("starts the independent count before the order query resolves", async () => {
    let finish!: (value: unknown[]) => void;
    dbMock.leadPurchase.findMany.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const pending = purchasesGET(request("view=orders&limit=10"));
    await vi.waitFor(() =>
      expect(dbMock.leadPurchase.count).toHaveBeenCalledOnce(),
    );
    finish([]);
    await pending;
  });

  it("returns compact quantities and accurate pagination", async () => {
    dbMock.leadPurchase.findMany.mockResolvedValue([
      {
        id: "p1",
        referenceId: "LD-ORD-ONE",
        amountPaid: "19.00",
        leadCount: 1000,
        _count: { unlockedLeads: 1000 },
        unlockedStates: ["CA"],
      },
    ]);
    dbMock.leadPurchase.count.mockResolvedValue(21);
    const body = await (
      await purchasesGET(request("view=orders&page=2&limit=10"))
    ).json();
    expect(body.purchases[0]).toMatchObject({ quantity: 1000, amountPaid: 19 });
    expect(body.purchases[0]._count).toBeUndefined();
    expect(body.purchases[0].unlockedLeads).toBeUndefined();
    expect(body.pagination).toMatchObject({
      page: 2,
      limit: 10,
      total: 21,
      totalPages: 3,
      hasMore: true,
    });
  });

  it("rejects invalid pagination without issuing queries", async () => {
    expect((await purchasesGET(request("page=NaN"))).status).toBe(400);
    expect(dbMock.leadPurchase.findMany).not.toHaveBeenCalled();
  });

  it("clamps the page size and applies search to both queries", async () => {
    await purchasesGET(request("q=ca&limit=500"));
    const query = dbMock.leadPurchase.findMany.mock.calls[0][0];
    expect(query.take).toBe(100);
    expect(query.where.OR).toContainEqual({
      unlockedStates: { hasSome: ["CA"] },
    });
    expect(dbMock.leadPurchase.count).toHaveBeenCalledWith({
      where: query.where,
    });
  });

  it("branches to authorized detail lookup without querying the order list", async () => {
    dbMock.leadPurchase.findFirst.mockResolvedValue({
      id: "p1",
      userId: "user-1",
      leadCount: 1,
      unlockedLeads: [{ agent: { id: "agent-1", fullName: "Agent" } }],
    });
    const body = await (await purchasesGET(request("purchaseId=p1"))).json();
    expect(dbMock.leadPurchase.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "p1", userId: "user-1", status: "COMPLETED" },
      }),
    );
    expect(dbMock.leadPurchase.findMany).not.toHaveBeenCalled();
    expect(dbMock.leadPurchase.count).not.toHaveBeenCalled();
    expect(body.leads).toHaveLength(1);
    expect(body.purchase.unlockedLeads).toBeUndefined();
  });

  it("returns 404 for an inaccessible order", async () => {
    dbMock.leadPurchase.findFirst.mockResolvedValue(null);
    expect(
      (await purchasesGET(request("purchaseId=someone-elses-order"))).status,
    ).toBe(404);
  });

  it("does not query purchases without authentication", async () => {
    authMock.mockResolvedValue(null);
    expect((await purchasesGET(request("view=orders"))).status).toBe(401);
    expect(dbMock.leadPurchase.findMany).not.toHaveBeenCalled();
  });
});

describe("database-side time buckets", () => {
  it("returns fourteen zero-filled UTC days with one query across a year boundary", async () => {
    dbMock.$queryRaw.mockResolvedValue([{ bucket: "2025-12-31", count: 7n }]);
    const result = await getScraperDailyCounts(
      14,
      new Date("2026-01-02T23:59:00Z"),
    );
    expect(dbMock.$queryRaw).toHaveBeenCalledOnce();
    expect(result).toHaveLength(14);
    expect(result[0]).toEqual({ date: "2025-12-20", count: 0 });
    expect(result.at(-1)).toEqual({ date: "2026-01-02", count: 0 });
    expect(result.find((row) => row.date === "2025-12-31")?.count).toBe(7);
    const [sql, from, until] = dbMock.$queryRaw.mock.calls[0];
    expect(sql.join("?")).toContain("GROUP BY 1");
    expect(from.toISOString()).toBe("2025-12-20T00:00:00.000Z");
    expect(until.toISOString()).toBe("2026-01-03T00:00:00.000Z");
  });

  it("rejects an invalid date window before querying", async () => {
    await expect(getScraperDailyCounts(0)).rejects.toThrow(RangeError);
    expect(dbMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("returns numeric month counts using one parameterized query and the legacy fallback", async () => {
    dbMock.$queryRaw.mockResolvedValue([{ bucket: "2026-01", count: 50000n }]);
    const from = new Date("2025-02-01T00:00:00Z");
    const until = new Date("2026-02-01T00:00:00Z");
    const counts = await getMonthlyLeadCounts("user-1", from, until);
    expect(counts.get("2026-01")).toBe(50000);
    expect(dbMock.$queryRaw).toHaveBeenCalledOnce();
    const [sql, ...params] = dbMock.$queryRaw.mock.calls[0];
    expect(sql.join("?")).toContain("NOT EXISTS (SELECT 1 FROM unlocked)");
    expect(sql.join("?")).not.toContain("user-1");
    expect(params).toEqual(["user-1", from, until, "user-1", from, until]);
    expect(dbMock.unlockedLead.findMany).not.toHaveBeenCalled();
  });
});

describe("inventory cache boundary", () => {
  it("authenticates before consulting the cache", async () => {
    authMock.mockResolvedValue(null);
    expect((await statsGET()).status).toBe(401);
    expect(cacheMock).not.toHaveBeenCalled();
    expect(dbMock.agent.groupBy).not.toHaveBeenCalled();
  });

  it("uses a 60 second TTL and bypasses Postgres on a cache hit", async () => {
    cacheMock.mockResolvedValue({ CA: 123 });
    expect(await (await statsGET()).json()).toEqual({ CA: 123 });
    expect(cacheMock).toHaveBeenCalledWith(
      "lead-state-inventory:v1",
      60,
      expect.any(Function),
    );
    expect(dbMock.agent.groupBy).not.toHaveBeenCalled();
  });

  it("computes deliverable inventory and zero-fills missing states on a miss", async () => {
    dbMock.agent.groupBy.mockResolvedValue([
      { state: "CA", _count: { id: 42 } },
    ]);
    const response = await statsGET();
    const body = await response.json();
    expect(body.CA).toBe(42);
    expect(body.NY).toBe(0);
    expect(dbMock.agent.groupBy).toHaveBeenCalledOnce();
    expect(dbMock.agent.groupBy.mock.calls[0][0].where.isDeliverable).toBe(
      true,
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
  });
});

it("returns a pending order's target quantity without loading its lead records", async () => {
  dbMock.leadPurchase.findMany.mockResolvedValue([
    {
      id: "pending",
      status: "PROCESSING",
      leadCount: 10,
      amountPaid: "0.19",
      _count: { unlockedLeads: 0 },
    },
  ]);
  dbMock.leadPurchase.count.mockResolvedValue(1);
  const body = await (await purchasesGET(request("view=orders"))).json();
  expect(body.purchases[0]).toMatchObject({
    status: "PROCESSING",
    quantity: 10,
  });
  expect(body.purchases[0]).not.toHaveProperty("unlockedLeads");
});
