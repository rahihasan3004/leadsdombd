import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => {
  const table = () =>
    Object.fromEntries(
      [
        "findMany",
        "count",
        "aggregate",
        "update",
        "updateMany",
        "create",
        "createMany",
      ].map((key) => [key, vi.fn()]),
    );
  return {
    run: table(),
    capacity: table(),
    candidate: table(),
    agent: table(),
    purchase: table(),
    transaction: vi.fn(),
    raw: vi.fn(),
    balance: vi.fn(),
    trigger: vi.fn(),
    status: vi.fn(),
    page: vi.fn(),
    deactivate: vi.fn(),
    abort: vi.fn(),
    bulk: vi.fn(),
  };
});
vi.mock("@fine-leads/database", async (original) => ({
  ...(await original<typeof import("@fine-leads/database")>()),
  db: {
    leadFulfillmentRun: m.run,
    lobstrCapacityReservation: m.capacity,
    leadFulfillmentCandidate: m.candidate,
    agent: m.agent,
    leadPurchase: m.purchase,
    $transaction: m.transaction,
  },
}));
vi.mock("../src/lib/scraper/lobstr-client", async (original) => ({
  ...(await original<typeof import("../src/lib/scraper/lobstr-client")>()),
  LobstrClient: class {
    getBalance = m.balance;
    triggerScrapeRun = m.trigger;
    getRunStatus = m.status;
    getRunResultsPage = m.page;
    deactivateSquid = m.deactivate;
    abortRun = m.abort;
  },
}));
vi.mock("../src/lib/scraper/bulk-ingestion", () => ({
  ingestLobstrPages: m.bulk,
}));
import {
  advanceParallelJob,
  concurrentMap,
  reserveParallelChildren,
  maintainParallelCapacity,
} from "../src/lib/scraper/parallel-dispatcher";
import { Prisma } from "@fine-leads/database";
type Row = Record<string, any>; // Test-only in-memory ledger; production types remain strict.
let runs: Row[] = [],
  capacities: Row[] = [],
  waiting = 0,
  parentStatus = "PROCESSING",
  serial = 0;
const tx = {
  leadFulfillmentRun: m.run,
  lobstrCapacityReservation: m.capacity,
  leadFulfillmentCandidate: m.candidate,
  agent: m.agent,
  leadPurchase: m.purchase,
  $queryRaw: m.raw,
};
const config = {
  version: 1 as const,
  batchSize: 100,
  concurrency: 5,
  accountConcurrency: 10,
  creditsPerResult: 10,
  maxProviderCredits: 10_000,
};
const balance = {
  available: 100_000,
  consumed: 0,
  used_slots: 0,
  total_available_slots: 10,
  has_unpaid_bill: {},
};
const child = (id: string, status = "QUEUED", extra: Row = {}): Row => ({
  id,
  jobId: "j1",
  state: "TX",
  zipCode: `787${String(++serial).padStart(2, "0")}`,
  status,
  targetQuantity: 100,
  runId: null,
  squidId: null,
  backupOfId: null,
  backupDepth: 0,
  newLeadCount: 0,
  lastError: null,
  resultPage: 1,
  resultOffset: 0,
  processedCount: 0,
  ...extra,
});
function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === "OR") return value.some((part: Row) => matches(row, part));
    if (key === "AND") return value.every((part: Row) => matches(row, part));
    const actual = row[key];
    if (value && typeof value === "object" && !(value instanceof Date)) {
      if ("in" in value) return value.in.includes(actual);
      if ("notIn" in value) return !value.notIn.includes(actual);
      if ("not" in value) return actual !== value.not;
      return matches(actual ?? {}, value);
    }
    return actual === value;
  });
}
const enriched = (run: Row): Row => ({
  ...run,
  capacity: capacities.find((cap) => cap.runRowId === run.id) ?? null,
  job: { purchase: { status: parentStatus } },
});
const capRows = (): Row[] =>
  capacities.map((cap) => ({
    ...cap,
    run: enriched(runs.find((run) => run.id === cap.runRowId)!),
  }));
function apply(row: Row, data: Row) {
  for (const [key, value] of Object.entries(data))
    row[key] =
      value && typeof value === "object" && "increment" in value
        ? (row[key] ?? 0) + value.increment
        : value;
}
const job = (): Parameters<typeof advanceParallelJob>[0] => ({
  id: "j1",
  purchaseId: "p1",
  status: "ACTIVE",
  category: "real estate agents",
  creditsHeld: 500,
  parallelConfig: config,
  expiresAt: new Date(Date.now() + 86_400_000),
  nextAttemptAt: new Date(),
  leaseToken: "lease",
  leaseUntil: new Date(Date.now() + 180_000),
  failureCount: 0,
  lastError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  purchase: {
    id: "p1",
    userId: "u1",
    referenceId: "order",
    status: "PROCESSING",
    tier: "PHONE_ONLY",
    state: null,
    unlockedStates: ["TX"],
    amountPaid: new Prisma.Decimal(0),
    leadCount: 500,
    stripeSessionId: null,
    refundedAt: null,
    lobstrRunId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
});
const hooks = () => ({
  guard: vi.fn().mockResolvedValue(undefined),
  complete: vi.fn().mockResolvedValue(false),
  refund: vi.fn().mockResolvedValue(true),
});
const advance = (actualJob = job(), actualHooks = hooks()) =>
  advanceParallelJob(actualJob, actualHooks, Date.now() + 90_000);
beforeEach(() => {
  for (const value of Object.values(m)) {
    if (typeof value === "function") value.mockReset();
    else for (const fn of Object.values(value)) fn.mockReset();
  }
  runs = [];
  capacities = [];
  waiting = 0;
  serial = 0;
  parentStatus = "PROCESSING";
  let tail = Promise.resolve();
  m.transaction.mockImplementation((callback) => {
    const result = tail.then(() => callback(tx));
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  });
  m.raw.mockResolvedValue([]);
  m.run.findMany.mockImplementation(async ({ where, take }: Row) =>
    runs
      .map(enriched)
      .filter((run) => matches(run, where))
      .slice(0, take ?? runs.length),
  );
  m.run.count.mockImplementation(
    async ({ where }: Row) =>
      runs.map(enriched).filter((run) => matches(run, where)).length,
  );
  m.run.update.mockImplementation(async ({ where, data }: Row) => {
    const row = runs.find((run) => matches(run, where))!;
    apply(row, data);
    return row;
  });
  m.run.updateMany.mockImplementation(async ({ where, data }: Row) => {
    const rows = runs.filter((run) => matches(run, where));
    rows.forEach((row) => apply(row, data));
    return { count: rows.length };
  });
  m.run.createMany.mockImplementation(async ({ data }: Row) => {
    for (const item of data)
      if (
        !runs.some(
          (run) =>
            (run.backupOfId === item.backupOfId && item.backupOfId) ||
            (run.jobId === item.jobId && run.zipCode === item.zipCode),
        )
      )
        runs.push(child(`backup-${++serial}`, "QUEUED", item));
    return { count: data.length };
  });
  m.run.aggregate.mockImplementation(async ({ where }: Row) => ({
    _min: {
      targetQuantity:
        Math.min(
          ...runs
            .filter((run) => matches(run, where))
            .map((run) => run.targetQuantity),
        ) === Infinity
          ? null
          : Math.min(
              ...runs
                .filter((run) => matches(run, where))
                .map((run) => run.targetQuantity),
            ),
    },
  }));
  m.capacity.findMany.mockImplementation(async ({ where, take }: Row) =>
    capRows()
      .filter((cap) => matches(cap, where))
      .slice(0, take ?? capacities.length),
  );
  m.capacity.count.mockImplementation(
    async ({ where }: Row) =>
      capRows().filter((cap) => matches(cap, where)).length,
  );
  m.capacity.aggregate.mockImplementation(async ({ where }: Row) => {
    const rows = capRows().filter((cap) => matches(cap, where));
    return {
      _count: { _all: rows.length },
      _sum: {
        estimatedCredits: rows.reduce(
          (sum, row) => sum + row.estimatedCredits,
          0,
        ),
      },
    };
  });
  m.capacity.create.mockImplementation(async ({ data }: Row) => {
    const row = { id: `cap-${capacities.length}`, status: "RESERVED", ...data };
    capacities.push(row);
    return row;
  });
  m.capacity.createMany.mockImplementation(async ({ data }: Row) => {
    for (const item of data)
      capacities.push({
        id: `cap-${capacities.length}`,
        status: "RESERVED",
        ...item,
      });
    return { count: data.length };
  });
  m.capacity.updateMany.mockImplementation(async ({ where, data }: Row) => {
    const selected = capRows().filter((cap) => matches(cap, where));
    for (const row of selected)
      apply(
        capacities.find((cap) => cap.id === row.id)!,
        data,
      );
    return { count: selected.length };
  });
  m.candidate.count.mockImplementation(async () => waiting);
  m.candidate.findMany.mockResolvedValue([]);
  m.candidate.createMany.mockImplementation(async ({ data }: Row) => ({
    count: data.length,
  }));
  m.candidate.updateMany.mockResolvedValue({ count: 1 });
  m.agent.findMany.mockImplementation(async ({ where }: Row) =>
    where.id.in.map((id: string) => ({ id })),
  );
  m.agent.count.mockResolvedValue(0);
  m.agent.updateMany.mockResolvedValue({ count: 1 });
  m.purchase.update.mockResolvedValue({});
  m.balance.mockResolvedValue(balance);
  m.trigger.mockImplementation(async (_params, options) => {
    const id = `remote-${++serial}`;
    await options.onSquidCreated(`squid-${id}`);
    return { id, squid: `squid-${id}` };
  });
  m.status.mockResolvedValue({ status: "RUNNING" });
  m.deactivate.mockResolvedValue(undefined);
  m.abort.mockResolvedValue(undefined);
  m.bulk.mockImplementation(async (pages, commit, guard) => {
    await guard(tx);
    await commit(tx, {
      pageAgentIds: pages.map((page: Row, index: number) =>
        page.records.length ? [`a${index}`] : [],
      ),
    });
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
describe("parallel capacity and child lifecycle", () => {
  it("serializes competing parent reservations and never oversells two provider slots", async () => {
    runs.push(child("a"), child("b"), child("c", "QUEUED", { jobId: "j2" }));
    const [first, second] = await Promise.all([
      reserveParallelChildren(
        job(),
        config,
        { ...balance, total_available_slots: 2 },
        hooks(),
      ),
      reserveParallelChildren(
        { ...job(), id: "j2" },
        config,
        { ...balance, total_available_slots: 2 },
        hooks(),
      ),
    ]);
    expect(first.length + second.length).toBe(2);
    expect(capacities).toHaveLength(2);
    expect(m.raw.mock.calls[0]![0].sql).toContain("pg_advisory_xact_lock");
  });
  it("batch-reserves a fifty-worker wave with two writes, not 100 sequential mutations", async () => {
    runs.push(...Array.from({ length: 50 }, (_, i) => child(`r${i}`)));
    const j = job();
    const scaled = {
      ...config,
      concurrency: 50,
      accountConcurrency: 50,
      maxProviderCredits: 100000,
    };
    const chosen = await reserveParallelChildren(
      j,
      scaled,
      { ...balance, total_available_slots: 50 },
      hooks(),
    );
    expect(chosen).toHaveLength(50);
    expect(capacities).toHaveLength(50);
    expect(m.run.updateMany).toHaveBeenCalledOnce();
    expect(m.capacity.createMany).toHaveBeenCalledOnce();
    expect(m.capacity.create).not.toHaveBeenCalled();
  });
  it("prevents two parent orders oversubscribing an account's fifty slots", async () => {
    runs.push(
      ...Array.from({ length: 50 }, (_, i) => child(`a${i}`)),
      ...Array.from({ length: 50 }, (_, i) =>
        child(`b${i}`, "QUEUED", { jobId: "j2" }),
      ),
    );
    const scaled = {
      ...config,
      concurrency: 50,
      accountConcurrency: 50,
      maxProviderCredits: 100000,
    };
    const [a, b] = await Promise.all([
      reserveParallelChildren(
        job(),
        scaled,
        { ...balance, total_available_slots: 50 },
        hooks(),
      ),
      reserveParallelChildren(
        { ...job(), id: "j2" },
        scaled,
        { ...balance, total_available_slots: 50 },
        hooks(),
      ),
    ]);
    expect(a.length + b.length).toBe(50);
    expect(new Set(capacities.map((row) => row.runRowId)).size).toBe(50);
  });
  it("dispatches fifty cloud runs when the account and funded order permit", async () => {
    runs.push(...Array.from({ length: 50 }, (_, i) => child(`r${i}`)));
    const j = job();
    j.parallelConfig = {
      ...config,
      concurrency: 50,
      accountConcurrency: 50,
      maxProviderCredits: 100000,
    };
    m.balance.mockResolvedValue({ ...balance, total_available_slots: 50 });
    await advance(j);
    expect(m.trigger).toHaveBeenCalledTimes(50);
    expect(
      runs.every((row) => row.status === "POLLING" && row.runId && row.squidId),
    ).toBe(true);
  });
  it("flushes fifty completed export pages through five bounded ingestion transactions", async () => {
    runs.push(
      ...Array.from({ length: 50 }, (_, i) =>
        child(`r${i}`, "POLLING", { runId: `remote${i}`, squidId: `sq${i}` }),
      ),
    );
    const j = job();
    j.parallelConfig = {
      ...config,
      concurrency: 50,
      accountConcurrency: 50,
      maxProviderCredits: 100000,
    };
    m.status.mockResolvedValue({ status: "DONE", export_done: true });
    m.page.mockResolvedValue({
      data: Array.from({ length: 100 }, () => ({})),
      total_results: 100,
      total_pages: 1,
    });
    const h = hooks();
    h.complete
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    expect((await advance(j, h)).status).toBe("COMPLETED");
    expect(m.bulk).toHaveBeenCalledTimes(5);
    expect(m.bulk.mock.calls.every((call) => call[0].length === 10)).toBe(true);
    expect(
      runs.every((row) => row.status === "DONE" && row.processedCount === 100),
    ).toBe(true);
  });

  it("finalizes after the first sufficient committed batch without touching remaining cursors", async () => {
    runs.push(
      ...Array.from({ length: 50 }, (_, i) =>
        child("r" + i, "POLLING", { runId: "remote" + i, squidId: "sq" + i }),
      ),
    );
    const j = job();
    j.parallelConfig = {
      ...config,
      concurrency: 50,
      accountConcurrency: 50,
      maxProviderCredits: 100000,
    };
    m.status.mockResolvedValue({ status: "DONE", export_done: true });
    m.page.mockResolvedValue({
      data: Array.from({ length: 100 }, () => ({})),
      total_results: 100,
      total_pages: 1,
    });
    const h = hooks();
    h.complete.mockResolvedValue(true);
    expect((await advance(j, h)).status).toBe("COMPLETED");
    expect(m.bulk).toHaveBeenCalledOnce();
    expect(runs.filter((row) => row.status === "DONE")).toHaveLength(10);
    expect(
      runs.filter(
        (row) => row.status === "POLLING" && row.processedCount === 0,
      ),
    ).toHaveLength(40);
    expect(m.trigger).not.toHaveBeenCalled();
  });
  it("does not reserve an unfunded provider shard", async () => {
    runs.push(child("a"));
    expect(
      await reserveParallelChildren(
        job(),
        config,
        { ...balance, available: 999 },
        hooks(),
      ),
    ).toEqual([]);
    expect(capacities).toEqual([]);
  });
  it("does not mutate reservations after the parent lease is lost", async () => {
    const h = hooks();
    h.guard.mockRejectedValue(new Error("lease lost"));
    runs.push(child("a"));
    await expect(
      reserveParallelChildren(job(), config, balance, h),
    ).rejects.toThrow("lease lost");
    expect(capacities).toEqual([]);
  });
  it("dispatches five funded children concurrently and persists every run and Squid", async () => {
    runs.push(...Array.from({ length: 5 }, (_, i) => child(`r${i}`)));
    await advance();
    expect(m.trigger).toHaveBeenCalledTimes(5);
    expect(
      runs.every((run) => run.status === "POLLING" && run.runId && run.squidId),
    ).toBe(true);
    expect(capacities.every((cap) => cap.status === "ACTIVE")).toBe(true);
  });
  it("bulk-ingests completed siblings together and finishes without extra dispatch", async () => {
    runs.push(
      child("a", "POLLING", { runId: "ra", squidId: "sa" }),
      child("b", "POLLING", { runId: "rb", squidId: "sb" }),
    );
    m.status.mockResolvedValue({ status: "DONE", export_done: true });
    m.page.mockResolvedValue({ data: [{}], total_results: 1, total_pages: 1 });
    const h = hooks();
    h.complete.mockResolvedValueOnce(true);
    expect((await advance(job(), h)).status).toBe("COMPLETED");
    expect(m.bulk).toHaveBeenCalledOnce();
    expect(m.bulk.mock.calls[0]![0]).toHaveLength(2);
    expect(
      runs.every((run) => run.status === "DONE" && run.processedCount === 1),
    ).toBe(true);
    expect(m.trigger).not.toHaveBeenCalled();
  });
  it("processes all email-export rows rather than truncating at business target count", async () => {
    runs.push(child("a", "POLLING", { runId: "ra", targetQuantity: 50 }));
    m.status.mockResolvedValue({ status: "DONE", export_done: true });
    m.page.mockResolvedValue({
      data: Array.from({ length: 100 }, () => ({})),
      total_results: 200,
      total_pages: 2,
    });
    await advance();
    expect(runs[0]).toMatchObject({
      status: "INGESTING",
      resultPage: 2,
      processedCount: 100,
    });
    expect(m.deactivate).not.toHaveBeenCalled();
  });
  it("replaces an empty child with a distinct ZIP without refunding running siblings", async () => {
    runs.push(
      child("a", "POLLING", { runId: "ra" }),
      child("b", "POLLING", { runId: "rb" }),
    );
    m.status.mockImplementation(async (id) =>
      id === "ra"
        ? { status: "DONE", export_done: true }
        : { status: "RUNNING" },
    );
    m.page.mockResolvedValue({ data: [], total_results: 0, total_pages: 0 });
    const h = hooks();
    await advance(job(), h);
    const backup = runs.find((run) => run.backupOfId === "a")!;
    expect(backup).toMatchObject({ backupDepth: 1, status: "POLLING" });
    expect(backup.zipCode).not.toBe(runs[0]!.zipCode);
    expect(runs[1]!.status).toBe("POLLING");
    expect(h.refund).not.toHaveBeenCalled();
  });
  it("replaces a failed child while a successful sibling remains running", async () => {
    runs.push(
      child("a", "POLLING", { runId: "ra" }),
      child("b", "POLLING", { runId: "rb" }),
    );
    m.status.mockImplementation(async (id) => ({
      status: id === "ra" ? "ERROR" : "RUNNING",
    }));
    await advance();
    expect(runs.find((run) => run.backupOfId === "a")?.status).toBe("POLLING");
    expect(runs[1]!.status).toBe("POLLING");
  });
  it("never blindly replays an interrupted chargeable dispatch", async () => {
    runs.push(child("a", "DISPATCHING"));
    capacities.push({
      id: "c",
      runRowId: "a",
      status: "RESERVED",
      estimatedCredits: 1000,
    });
    expect((await advance()).status).toBe("NEEDS_REVIEW");
    expect(runs[0]!.status).toBe("UNKNOWN");
    expect(capacities[0]!.status).toBe("UNKNOWN");
    expect(m.trigger).not.toHaveBeenCalled();
  });
  it("isolates an ambiguous provider failure instead of failing other children", async () => {
    runs.push(child("a"), child("b"));
    m.trigger.mockRejectedValueOnce(new Error("transport uncertain"));
    const h = hooks();
    await advance(job(), h);
    expect(runs[0]!.status).toBe("UNKNOWN");
    expect(runs[1]!.status).toBe("POLLING");
    expect(h.refund).not.toHaveBeenCalled();
  });
  it("bounds backup depth and refunds exhausted qualified inventory", async () => {
    runs.push(child("a", "FAILED", { backupDepth: 2 }));
    const h = hooks();
    expect((await advance(job(), h)).status).toBe("REFUNDED");
    expect(m.trigger).not.toHaveBeenCalled();
    expect(h.refund).toHaveBeenCalledWith(
      "PARALLEL_QUALIFIED_INVENTORY_EXHAUSTED",
    );
  });
  it("does not fake SMTP verification inside an HTTP coordinator", async () => {
    runs.push(child("a", "DONE", { newLeadCount: 100 }));
    waiting = 1;
    const j = job();
    j.purchase.tier = "VERIFIED_EMAIL";
    expect((await advance(j)).status).toBe("WAITING_VERIFICATION");
    expect(m.agent.updateMany).not.toHaveBeenCalled();
  });
  it("skips SMTP checks for phone-only orders", async () => {
    const h = { ...hooks(), verifyEmail: vi.fn() };
    runs.push(child("a", "POLLING", { runId: "ra" }));
    await advance(job(), h);
    expect(h.verifyEmail).not.toHaveBeenCalled();
  });
  it("rejects MX-only results without granting verified-email eligibility", async () => {
    const j = job();
    j.purchase.tier = "VERIFIED_EMAIL";
    waiting = 1;
    runs.push(child("a", "DONE", { newLeadCount: 100 }));
    m.candidate.findMany.mockResolvedValue([
      {
        agentId: "a1",
        verificationAttempts: 0,
        agent: { id: "a1", email: "one@example.com" },
      },
    ]);
    const h = {
      ...hooks(),
      verifyEmail: vi.fn().mockResolvedValue({
        email: "one@example.com",
        status: "mx_found",
        isDeliverable: true,
        isCatchAll: false,
        isDisposable: false,
        smtpCode: null,
      }),
    };
    await advance(j, h);
    expect(m.agent.updateMany).not.toHaveBeenCalled();
    expect(m.candidate.updateMany.mock.calls[0]![0].data.verificationDone).toBe(
      false,
    );
  });
  it("bulk-applies matching SMTP 250 evidence before atomic completion", async () => {
    const j = job();
    j.purchase.tier = "VERIFIED_EMAIL";
    waiting = 1;
    runs.push(child("a", "DONE", { newLeadCount: 100 }));
    m.candidate.findMany.mockResolvedValue([
      {
        agentId: "a1",
        verificationAttempts: 0,
        agent: { id: "a1", email: "one@example.com" },
      },
    ]);
    const h = {
      ...hooks(),
      verifyEmail: vi.fn().mockResolvedValue({
        email: "one@example.com",
        status: "deliverable",
        isDeliverable: true,
        isCatchAll: false,
        isDisposable: false,
        smtpCode: 250,
      }),
    };
    h.complete.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    expect((await advance(j, h)).status).toBe("COMPLETED");
    expect(m.agent.updateMany.mock.calls[0]![0]).toMatchObject({
      where: { OR: [{ id: "a1", email: "one@example.com" }] },
      data: { isDeliverable: true, isVerified: true },
    });
    expect(m.candidate.updateMany.mock.calls[0]![0].data.verificationDone).toBe(
      true,
    );
  });
  it("retains capacity until an aborted live run is confirmed terminal", async () => {
    parentStatus = "COMPLETED";
    runs.push(child("a", "POLLING", { runId: "ra", squidId: "sa" }));
    capacities.push({
      id: "c",
      runRowId: "a",
      status: "ACTIVE",
      estimatedCredits: 1000,
    });
    await maintainParallelCapacity();
    expect(m.abort).toHaveBeenCalledWith("ra");
    expect(capacities[0]!.status).toBe("ACTIVE");
    m.status.mockResolvedValue({ status: "ABORTED" });
    await maintainParallelCapacity();
    expect(m.deactivate).toHaveBeenCalledWith("sa");
    expect(capacities[0]!.status).toBe("RELEASED");
  });
  it("never releases an unknown paid request merely because its parent was refunded", async () => {
    parentStatus = "REFUNDED";
    runs.push(child("a", "FAILED", { squidId: "sa" }));
    capacities.push({
      id: "c",
      runRowId: "a",
      status: "UNKNOWN",
      estimatedCredits: 1000,
    });
    await maintainParallelCapacity();
    expect(capacities[0]!.status).toBe("UNKNOWN");
    expect(m.deactivate).not.toHaveBeenCalled();
  });
  it("bounds concurrent tasks and isolates a child exception", async () => {
    let active = 0,
      peak = 0;
    const results = await concurrentMap(
      Array.from({ length: 20 }, (_, i) => i),
      5,
      async (index) => {
        peak = Math.max(peak, ++active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active--;
        if (index === 7) throw new Error("child failed");
        return index;
      },
    );
    expect(peak).toBe(5);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(results[19]).toEqual({ status: "fulfilled", value: 19 });
  });
});
