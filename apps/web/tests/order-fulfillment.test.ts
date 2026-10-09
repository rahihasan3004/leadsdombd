import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => {
  const methods = () => ({
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  });
  const db = {
    leadFulfillmentJob: methods(),
    leadFulfillmentRun: methods(),
    leadFulfillmentCandidate: methods(),
    leadPurchase: methods(),
    agent: methods(),
    user: methods(),
    walletTransaction: methods(),
    unlockedLead: methods(),
    $transaction: vi.fn(),
  };
  return {
    db,
    trigger: vi.fn(),
    status: vi.fn(),
    page: vi.fn(),
    ingest: vi.fn(),
  };
});
vi.mock("@fine-leads/database", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@fine-leads/database")>()),
  db: mocks.db,
}));
vi.mock("../src/lib/scraper/lead-mapper", () => ({
  ingestLobstrLead: mocks.ingest,
}));
vi.mock("../src/lib/scraper/lobstr-client", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../src/lib/scraper/lobstr-client")>();
  return {
    ...original,
    LobstrClient: class {
      triggerScrapeRun = mocks.trigger;
      getRunStatus = mocks.status;
      getRunResultsPage = mocks.page;
    },
  };
});
import {
  completeFulfillment,
  refundFulfillment,
  processNextFulfillment,
} from "../src/lib/scraper/order-fulfillment";
import type { Prisma } from "@fine-leads/database";
const now = new Date();
const job = {
  id: "job-1",
  purchaseId: "p1",
  status: "ACTIVE",
  category: "real estate agents",
  creditsHeld: 4,
  expiresAt: new Date(Date.now() + 86_400_000),
  nextAttemptAt: now,
  leaseToken: "token",
  leaseUntil: new Date(Date.now() + 180_000),
  failureCount: 0,
  lastError: null,
  createdAt: now,
  updatedAt: now,
  purchase: {
    id: "p1",
    userId: "u1",
    status: "PROCESSING",
    tier: "VERIFIED_EMAIL",
    leadCount: 2,
    unlockedStates: ["TX"],
    referenceId: "ref",
    state: null,
    amountPaid: {} as Prisma.Decimal,
    stripeSessionId: null,
    refundedAt: null,
    lobstrRunId: null,
    createdAt: now,
    updatedAt: now,
  },
} satisfies Prisma.LeadFulfillmentJobGetPayload<{
  include: { purchase: true };
}>;
const run = {
  id: "r1",
  jobId: "job-1",
  state: "TX",
  targetQuantity: 2,
  status: "QUEUED",
  runId: null,
  resultPage: 1,
  resultOffset: 0,
  processedCount: 0,
};
beforeEach(() => {
  for (const table of Object.values(mocks.db)) {
    if (typeof table === "function") table.mockReset();
    else for (const method of Object.values(table)) method.mockReset();
  }
  for (const table of Object.values(mocks.db))
    if (typeof table !== "function") {
      table.findMany.mockResolvedValue([]);
      table.findFirst.mockResolvedValue(null);
      table.updateMany.mockResolvedValue({ count: 1 });
      table.createMany.mockResolvedValue({ count: 2 });
      table.update.mockResolvedValue({});
      table.create.mockResolvedValue({});
      table.upsert.mockResolvedValue({});
    }
  mocks.db.$transaction.mockImplementation((callback) => callback(mocks.db));
  mocks.db.leadPurchase.findUniqueOrThrow.mockResolvedValue(job.purchase);
  mocks.db.leadFulfillmentJob.findFirst.mockResolvedValue(job);
  mocks.db.leadFulfillmentJob.findUniqueOrThrow.mockResolvedValue(job);
  mocks.db.user.update.mockResolvedValue({ credits: 14 });
  mocks.trigger
    .mockReset()
    .mockResolvedValue({ id: "lobstr-1", status: "PENDING" });
  mocks.status
    .mockReset()
    .mockResolvedValue({ id: "lobstr-1", status: "DONE", export_done: true });
  mocks.page
    .mockReset()
    .mockResolvedValue({
      page: 1,
      total_pages: 1,
      total_results: 1,
      data: [{ name: "Lead" }],
    });
  mocks.ingest
    .mockReset()
    .mockResolvedValue({ kind: "lead", agentId: "a1", created: false });
});

describe("atomic fulfillment and refund", () => {
  it("does not complete or allocate a partial result set", async () => {
    mocks.db.agent.findMany.mockResolvedValue([{ id: "a1" }]);
    expect(await completeFulfillment(job, "token")).toBe(false);
    expect(mocks.db.leadPurchase.updateMany).not.toHaveBeenCalled();
    expect(mocks.db.unlockedLead.createMany).not.toHaveBeenCalled();
  });
  it("prefers job candidates, allocates exactly the target and settles without another debit", async () => {
    mocks.db.leadFulfillmentCandidate.findMany.mockResolvedValue([
      { agentId: "a1" },
    ]);
    mocks.db.agent.findMany.mockResolvedValue([{ id: "a2" }]);
    expect(await completeFulfillment(job, "token")).toBe(true);
    expect(mocks.db.unlockedLead.createMany).toHaveBeenCalledWith({
      data: [
        { userId: "u1", purchaseId: "p1", agentId: "a1" },
        { userId: "u1", purchaseId: "p1", agentId: "a2" },
      ],
    });
    expect(mocks.db.agent.findMany.mock.calls[0]![0].where).toMatchObject({
      id: { notIn: ["a1"] },
      isDeliverable: true,
      emailStatus: { in: ["validated", "deliverable"] },
      unlockedBy: { none: { userId: "u1" } },
    });
    expect(mocks.db.user.update).not.toHaveBeenCalled();
    expect(mocks.db.walletTransaction.updateMany).toHaveBeenCalled();
  });
  it("does not skip unique conflicts or mark an incomplete order complete", async () => {
    mocks.db.agent.findMany.mockResolvedValue([{ id: "a1" }, { id: "a2" }]);
    mocks.db.unlockedLead.createMany.mockRejectedValue({ code: "P2002" });
    await expect(completeFulfillment(job, "token")).rejects.toEqual({
      code: "P2002",
    });
    expect(mocks.db.leadFulfillmentJob.update).not.toHaveBeenCalled();
  });
  it("returns the exact held credits on a conditional PROCESSING refund", async () => {
    expect(await refundFulfillment(job, "token", "FAILED_RUN")).toBe(true);
    expect(mocks.db.leadPurchase.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "p1", status: "PROCESSING" },
        data: expect.objectContaining({ status: "REFUNDED" }),
      }),
    );
    expect(mocks.db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { credits: { increment: 4 } } }),
    );
    expect(
      mocks.db.walletTransaction.create.mock.calls[0]![0].data,
    ).toMatchObject({ amount: 4, type: "REFUND", balanceAfter: 14 });
  });
  it("does not refund twice after the status transition", async () => {
    mocks.db.leadPurchase.updateMany.mockResolvedValue({ count: 0 });
    expect(await refundFulfillment(job, "token", "REPLAY")).toBe(false);
    expect(mocks.db.user.update).not.toHaveBeenCalled();
    expect(mocks.db.walletTransaction.create).not.toHaveBeenCalled();
  });
  it("rejects stale leases before writing allocations or refunds", async () => {
    mocks.db.leadFulfillmentJob.updateMany.mockResolvedValue({ count: 0 });
    await expect(refundFulfillment(job, "stale", "REPLAY")).rejects.toThrow(
      "lease lost",
    );
    expect(mocks.db.leadPurchase.updateMany).not.toHaveBeenCalled();
  });
});

describe("durable order worker", () => {
  it("returns idle with no queued jobs", async () => {
    mocks.db.leadFulfillmentJob.findFirst.mockResolvedValue(null);
    expect(await processNextFulfillment()).toEqual({
      worked: false,
      status: "IDLE",
    });
    expect(mocks.trigger).not.toHaveBeenCalled();
  });
  it("only one competing worker can claim a job", async () => {
    mocks.db.leadFulfillmentJob.updateMany.mockResolvedValue({ count: 0 });
    expect(await processNextFulfillment()).toEqual({
      worked: false,
      status: "BUSY",
    });
    expect(mocks.trigger).not.toHaveBeenCalled();
  });
  it("dispatches once after persisting DISPATCHING and saves the run on the purchase", async () => {
    mocks.db.leadFulfillmentRun.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(run);
    expect((await processNextFulfillment()).status).toBe("DISPATCHED");
    expect(mocks.trigger).toHaveBeenCalledWith({
      state: "TX",
      category: "real estate agents",
      limit: 2,
    });
    expect(
      mocks.db.leadFulfillmentRun.update.mock.calls[0]![0].data.status,
    ).toBe("DISPATCHING");
    expect(
      mocks.db.leadFulfillmentRun.update.mock.calls[1]![0].data,
    ).toMatchObject({ status: "POLLING", runId: "lobstr-1" });
    expect(mocks.db.leadPurchase.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { lobstrRunId: "lobstr-1" },
    });
  });
  it("does not blindly repeat a paid dispatch after a worker interruption", async () => {
    mocks.db.leadFulfillmentRun.findFirst.mockResolvedValueOnce({
      ...run,
      status: "DISPATCHING",
    });
    expect((await processNextFulfillment()).status).toBe("NEEDS_REVIEW");
    expect(mocks.trigger).not.toHaveBeenCalled();
    expect(
      mocks.db.leadFulfillmentRun.update.mock.calls[0]![0].data.status,
    ).toBe("UNKNOWN");
  });
  it("records an ambiguous upstream failure without re-dispatching", async () => {
    mocks.db.leadFulfillmentRun.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(run);
    mocks.trigger.mockRejectedValue(new Error("response lost"));
    expect((await processNextFulfillment()).status).toBe("NEEDS_REVIEW");
    expect(mocks.trigger).toHaveBeenCalledTimes(1);
  });
  it("does not ingest before the export is ready", async () => {
    mocks.db.leadFulfillmentRun.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...run, status: "POLLING", runId: "lobstr-1" });
    mocks.status.mockResolvedValue({ status: "DONE", export_done: false });
    expect((await processNextFulfillment()).status).toBe("POLLING");
    expect(mocks.ingest).not.toHaveBeenCalled();
  });
  it("advances a completed export to ingestion", async () => {
    mocks.db.leadFulfillmentRun.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...run, status: "POLLING", runId: "lobstr-1" });
    expect((await processNextFulfillment()).status).toBe("INGESTING");
    expect(
      mocks.db.leadFulfillmentRun.update.mock.calls[0]![0].data.status,
    ).toBe("INGESTING");
  });
  it("reconnects a duplicate existing Agent and checkpoints its cursor atomically", async () => {
    mocks.db.leadFulfillmentRun.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...run,
        status: "INGESTING",
        runId: "lobstr-1",
      });
    expect((await processNextFulfillment()).status).toBe("INGESTING");
    expect(mocks.db.leadFulfillmentCandidate.upsert).toHaveBeenCalledWith({
      where: { jobId_agentId: { jobId: "job-1", agentId: "a1" } },
      create: { jobId: "job-1", agentId: "a1" },
      update: {},
    });
    expect(
      mocks.db.leadFulfillmentRun.update.mock.calls[0]![0].data,
    ).toMatchObject({ resultOffset: 1, processedCount: 1 });
    expect(
      mocks.db.leadFulfillmentRun.update.mock.calls[1]![0].data.status,
    ).toBe("DONE");
  });
  it("resumes after an already-committed record offset", async () => {
    mocks.page.mockResolvedValue({
      page: 1,
      total_pages: 1,
      total_results: 2,
      data: [{ name: "old" }, { name: "new" }],
    });
    mocks.db.leadFulfillmentRun.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...run,
        status: "INGESTING",
        runId: "lobstr-1",
        resultOffset: 1,
        processedCount: 1,
      });
    await processNextFulfillment();
    expect(mocks.ingest).toHaveBeenCalledTimes(1);
    expect(mocks.ingest.mock.calls[0]![0]).toEqual({ name: "new" });
  });
  it("refunds failed Lobstr runs instead of exposing partial results", async () => {
    mocks.db.leadFulfillmentRun.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...run, status: "POLLING", runId: "lobstr-1" });
    mocks.status.mockResolvedValue({ status: "ERROR" });
    expect((await processNextFulfillment()).status).toBe("REFUNDED");
    expect(mocks.db.user.update).toHaveBeenCalled();
    expect(mocks.ingest).not.toHaveBeenCalled();
  });
  it("refunds expired jobs without dispatch", async () => {
    mocks.db.leadFulfillmentJob.findUniqueOrThrow.mockResolvedValue({
      ...job,
      expiresAt: new Date(0),
    });
    expect((await processNextFulfillment()).status).toBe("REFUNDED");
    expect(mocks.trigger).not.toHaveBeenCalled();
  });
  it("keeps verified orders pending when no SMTP-capable consumer is present", async () => {
    mocks.db.leadFulfillmentCandidate.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          verificationDone: false,
          nextVerificationAt: now,
          agent: { id: "a1", email: "sales@example.com" },
        },
      ]);
    expect((await processNextFulfillment()).status).toBe(
      "WAITING_VERIFICATION",
    );
    expect(mocks.db.user.update).not.toHaveBeenCalled();
  });
  it("never upgrades a candidate on an MX-only result even if the legacy flag is true", async () => {
    mocks.db.leadFulfillmentCandidate.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          jobId: job.id,
          agentId: "a1",
          verificationAttempts: 0,
          nextVerificationAt: now,
          agent: { id: "a1", email: "sales@example.com" },
        },
      ])
      .mockResolvedValue([]);
    const verifyEmail = vi
      .fn()
      .mockResolvedValue({
        email: "sales@example.com",
        status: "mx_verified",
        isDeliverable: true,
        smtpCode: null,
        isCatchAll: false,
        isDisposable: false,
      });
    expect((await processNextFulfillment({ verifyEmail })).status).toBe(
      "VERIFYING",
    );
    expect(mocks.db.agent.updateMany).not.toHaveBeenCalled();
  });
});

it("fulfills a verified order only after a matching positive SMTP result", async () => {
  mocks.db.leadFulfillmentCandidate.findMany
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      {
        jobId: job.id,
        agentId: "a1",
        verificationAttempts: 0,
        nextVerificationAt: now,
        agent: { id: "a1", email: "sales@example.com" },
      },
    ])
    .mockResolvedValueOnce([{ agentId: "a1" }]);
  mocks.db.agent.findMany
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: "a2" }]);
  const verifyEmail = vi
    .fn()
    .mockResolvedValue({
      email: "sales@example.com",
      status: "deliverable",
      isDeliverable: true,
      smtpCode: 250,
      isCatchAll: false,
      isDisposable: false,
    });
  expect((await processNextFulfillment({ verifyEmail })).status).toBe(
    "COMPLETED",
  );
  expect(mocks.db.agent.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: "a1", email: "sales@example.com" },
      data: expect.objectContaining({
        emailStatus: "deliverable",
        isDeliverable: true,
      }),
    }),
  );
  expect(mocks.db.unlockedLead.createMany).toHaveBeenCalledTimes(1);
  expect(mocks.db.user.update).not.toHaveBeenCalled();
});

it("refunds after bounded transient retries without dispatching another run", async () => {
  mocks.db.leadFulfillmentJob.findUniqueOrThrow.mockResolvedValue({
    ...job,
    failureCount: 7,
  });
  mocks.db.leadFulfillmentRun.findFirst
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ ...run, status: "POLLING", runId: "lobstr-1" });
  mocks.status.mockRejectedValue(new Error("private provider details"));
  expect((await processNextFulfillment()).status).toBe("REFUNDED");
  expect(mocks.trigger).not.toHaveBeenCalled();
});

it("re-verifies stale duplicate candidates instead of excluding known email statuses", async () => {
  mocks.db.leadFulfillmentCandidate.findMany
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      {
        jobId: job.id,
        agentId: "a1",
        verificationAttempts: 0,
        nextVerificationAt: now,
        agent: { id: "a1", email: "sales@example.com" },
      },
    ])
    .mockResolvedValue([]);
  const verifyEmail = vi
    .fn()
    .mockResolvedValue({
      email: "sales@example.com",
      status: "undeliverable",
      isDeliverable: false,
      smtpCode: 550,
      isCatchAll: false,
      isDisposable: false,
    });
  await processNextFulfillment({ verifyEmail });
  expect(
    mocks.db.leadFulfillmentCandidate.findMany.mock.calls[1]![0].where.agent,
  ).toEqual({ email: { not: null } });
  expect(mocks.db.agent.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        isDeliverable: false,
        emailStatus: "undeliverable",
      }),
    }),
  );
});
