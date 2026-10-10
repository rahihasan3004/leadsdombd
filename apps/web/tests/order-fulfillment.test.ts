import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    orderEmailNotification: methods(),
    auditLog: methods(),
    $transaction: vi.fn(),
  };
  return {
    db,
    transactionActive: false,
    completedEmail: vi.fn(),
    failedEmail: vi.fn(),
    configuration: vi.fn(),
    trigger: vi.fn(),
    status: vi.fn(),
    page: vi.fn(),
    ingest: vi.fn(),
    apifyDispatch: vi.fn(),
    apifyStatus: vi.fn(),
    apifyPage: vi.fn(),
    apifyIngest: vi.fn(),
    apifyBatch: vi.fn(),
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
      constructor() {
        mocks.configuration();
      }
      triggerScrapeRun = mocks.trigger;
      getRunStatus = mocks.status;
      getRunResultsPage = mocks.page;
    },
  };
});
vi.mock("../src/lib/email/order-emails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/email/order-emails")>()),
  sendOrderCompletedEmail: mocks.completedEmail,
  sendOrderFailedEmail: mocks.failedEmail,
}));
import {
  completeFulfillment,
  refundFulfillment,
  processNextFulfillment,
} from "../src/lib/scraper/order-fulfillment";
import {
  LobstrError,
  LobstrDispatchError,
} from "../src/lib/scraper/lobstr-client";
vi.mock("../src/lib/scraper/apify-client", async (original) => ({
  ...(await original<typeof import("../src/lib/scraper/apify-client")>()),
  CompassApifyClient: class {
    dispatchApifyScrape = mocks.apifyDispatch;
    getRun = mocks.apifyStatus;
    getDatasetPage = mocks.apifyPage;
  },
}));
vi.mock("../src/lib/scraper/apify-mapper", () => ({
  ingestApifyLead: mocks.apifyIngest,
  ingestApifyPages: mocks.apifyBatch,
}));
import { ApifyError } from "../src/lib/scraper/apify-token-pool";
import type { Prisma } from "@fine-leads/database";
const now = new Date();
const job = {
  id: "job-1",
  purchaseId: "p1",
  status: "ACTIVE",
  category: "real estate agents",
  creditsHeld: 4,
  parallelConfig: null,
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
  for (const fn of [
    mocks.apifyDispatch,
    mocks.apifyStatus,
    mocks.apifyPage,
    mocks.apifyIngest,
  ])
    fn.mockReset();
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
  mocks.apifyBatch
    .mockReset()
    .mockImplementation(async (pages, commit, guard) => {
      const agentIds: string[] = [];
      let newlyIngested = 0;
      for (const record of pages[0].records) {
        const mapped = await mocks.apifyIngest(record);
        if (mapped?.kind === "lead") {
          agentIds.push(mapped.agentId);
          if (mapped.created) newlyIngested++;
        }
      }
      const result = { agentIds, newlyIngested };
      return mocks.db.$transaction(async (tx: typeof mocks.db) => {
        await guard(tx);
        await commit(tx, result);
        return result;
      });
    });
  mocks.transactionActive = false;
  for (const sender of [mocks.completedEmail, mocks.failedEmail])
    sender.mockReset().mockImplementation(async () => {
      expect(mocks.transactionActive).toBe(false);
      expect(mocks.db.orderEmailNotification.upsert).toHaveBeenCalled();
      return { success: true, status: "SENT" };
    });
  mocks.db.$transaction.mockImplementation(async (callback) => {
    mocks.transactionActive = true;
    try {
      return await callback(mocks.db);
    } finally {
      mocks.transactionActive = false;
    }
  });
  mocks.db.leadPurchase.findUniqueOrThrow.mockResolvedValue(job.purchase);
  mocks.db.leadFulfillmentJob.findFirst.mockResolvedValue(job);
  mocks.db.leadFulfillmentJob.findUniqueOrThrow.mockResolvedValue(job);
  mocks.db.user.update.mockResolvedValue({ credits: 14 });
  mocks.configuration.mockReset();
  mocks.trigger
    .mockReset()
    .mockResolvedValue({ id: "lobstr-1", status: "PENDING" });
  mocks.status
    .mockReset()
    .mockResolvedValue({ id: "lobstr-1", status: "DONE", export_done: true });
  mocks.page.mockReset().mockResolvedValue({
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
      emailStatus: {
        in: ["validated", "deliverable", "syntax_valid", "mx_valid"],
      },
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
    ).toMatchObject({
      amount: 4,
      type: "REFUND",
      balanceAfter: 14,
    });
  });
  it("marks failed card fulfillment for external refund without inventing refunded credits", async () => {
    expect(
      await refundFulfillment(
        { ...job, creditsHeld: 0 },
        "token",
        "FAILED_RUN",
      ),
    ).toBe(true);
    expect(mocks.db.leadPurchase.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
    expect(mocks.db.user.update).not.toHaveBeenCalled();
    expect(mocks.db.walletTransaction.create).not.toHaveBeenCalled();
    expect(mocks.failedEmail).not.toHaveBeenCalled();
    expect(mocks.db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "card_order.refund_required" }),
      }),
    );
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
    ).toMatchObject({
      status: "POLLING",
      runId: "lobstr-1",
    });
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
    ).toMatchObject({
      resultOffset: 1,
      processedCount: 1,
    });
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
    const verifyEmail = vi.fn().mockResolvedValue({
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
  const verifyEmail = vi.fn().mockResolvedValue({
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
  const verifyEmail = vi.fn().mockResolvedValue({
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
  ).toEqual({
    email: { not: null },
  });
  expect(mocks.db.agent.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        isDeliverable: false,
        emailStatus: "undeliverable",
      }),
    }),
  );
});

describe("post-commit order email lifecycle", () => {
  it("queues and sends completion only after successful commit", async () => {
    mocks.db.agent.findMany.mockResolvedValue([{ id: "a1" }, { id: "a2" }]);
    expect(await completeFulfillment(job, "token")).toBe(true);
    expect(mocks.db.orderEmailNotification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { purchaseId: "p1", kind: "COMPLETED" },
      }),
    );
    expect(mocks.completedEmail).toHaveBeenCalledExactlyOnceWith("p1");
  });
  it("does not email incomplete deliveries", async () => {
    expect(await completeFulfillment(job, "token")).toBe(false);
    expect(mocks.completedEmail).not.toHaveBeenCalled();
    expect(mocks.db.orderEmailNotification.upsert).not.toHaveBeenCalled();
  });
  it("does not email failed allocation transactions", async () => {
    mocks.db.agent.findMany.mockResolvedValue([{ id: "a1" }, { id: "a2" }]);
    mocks.db.unlockedLead.createMany.mockRejectedValue(
      new Error("allocation failed"),
    );
    await expect(completeFulfillment(job, "token")).rejects.toThrow(
      "allocation failed",
    );
    expect(mocks.completedEmail).not.toHaveBeenCalled();
  });
  it("does not turn a committed completion into a failure when email throws", async () => {
    mocks.db.agent.findMany.mockResolvedValue([{ id: "a1" }, { id: "a2" }]);
    mocks.completedEmail.mockRejectedValue(new Error("provider unavailable"));
    expect(await completeFulfillment(job, "token")).toBe(true);
    expect(mocks.failedEmail).not.toHaveBeenCalled();
  });
  it("queues refund notification after the credits are returned", async () => {
    expect(await refundFulfillment(job, "token", "EXPIRED")).toBe(true);
    expect(mocks.db.orderEmailNotification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { purchaseId: "p1", kind: "FAILED" } }),
    );
    expect(mocks.failedEmail).toHaveBeenCalledExactlyOnceWith("p1");
  });
  it("does not email a duplicate refund", async () => {
    mocks.db.leadPurchase.updateMany.mockResolvedValue({ count: 0 });
    expect(await refundFulfillment(job, "token", "REPLAY")).toBe(false);
    expect(mocks.failedEmail).not.toHaveBeenCalled();
    expect(mocks.db.orderEmailNotification.upsert).not.toHaveBeenCalled();
  });
  it("preserves a successful refund when email throws", async () => {
    mocks.failedEmail.mockRejectedValue(new Error("provider unavailable"));
    expect(await refundFulfillment(job, "token", "EXPIRED")).toBe(true);
    expect(mocks.db.user.update).toHaveBeenCalledOnce();
  });
});

it("completes and notifies in the same stage once ingestion supplies eligible inventory", async () => {
  mocks.db.leadFulfillmentRun.findFirst
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ ...run, status: "INGESTING", runId: "lobstr-1" });
  mocks.db.agent.findMany
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: "a1" }, { id: "a2" }]);
  expect((await processNextFulfillment()).status).toBe("COMPLETED");
  expect(mocks.ingest).toHaveBeenCalledOnce();
  expect(mocks.completedEmail).toHaveBeenCalledExactlyOnceWith("p1");
  expect(mocks.db.unlockedLead.createMany).toHaveBeenCalledOnce();
});

describe("known dispatch rejection versus uncertain delivery", () => {
  beforeEach(() => {
    mocks.db.leadFulfillmentRun.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(run);
  });
  it("refunds an explicit invalid-key rejection instead of stranding the customer", async () => {
    mocks.trigger.mockRejectedValue(
      new LobstrDispatchError(
        new LobstrError("HTTP 401", 401, "HTTP_ERROR"),
        "CREATE_RUN",
        "squid-1",
      ),
    );
    expect((await processNextFulfillment()).status).toBe("REFUNDED");
    expect(mocks.db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { credits: { increment: 4 } } }),
    );
    expect(
      mocks.db.leadFulfillmentRun.update.mock.calls[1]![0].data.status,
    ).toBe("FAILED");
    expect(mocks.failedEmail).toHaveBeenCalledOnce();
  });
  it("requeues transient setup failures with the existing backoff", async () => {
    mocks.trigger.mockRejectedValue(
      new LobstrDispatchError(
        new LobstrError("timeout", undefined, "TIMEOUT"),
        "CREATE_TASKS",
        "squid-1",
      ),
    );
    expect((await processNextFulfillment()).status).toBe("RETRYING");
    expect(
      mocks.db.leadFulfillmentRun.update.mock.calls[1]![0].data.status,
    ).toBe("QUEUED");
    expect(mocks.db.user.update).not.toHaveBeenCalled();
  });
  it("keeps chargeable run transport timeouts uncertain", async () => {
    mocks.trigger.mockRejectedValue(
      new LobstrDispatchError(
        new LobstrError("timeout", undefined, "TIMEOUT"),
        "CREATE_RUN",
        "squid-1",
      ),
    );
    expect((await processNextFulfillment()).status).toBe("NEEDS_REVIEW");
    expect(
      mocks.db.leadFulfillmentRun.update.mock.calls[1]![0].data.status,
    ).toBe("UNKNOWN");
    expect(mocks.db.user.update).not.toHaveBeenCalled();
  });
  it("releases the hold if configuration is lost after accepting an order", async () => {
    mocks.configuration.mockImplementation(() => {
      throw new LobstrError("API key missing", undefined, "CONFIGURATION");
    });
    expect((await processNextFulfillment()).status).toBe("REFUNDED");
    expect(mocks.trigger).not.toHaveBeenCalled();
    expect(mocks.db.leadFulfillmentRun.updateMany).toHaveBeenCalledWith({
      where: { jobId: "job-1", status: { notIn: ["DONE", "FAILED"] } },
      data: { status: "FAILED" },
    });
  });
});

describe("Apify durable fulfillment lifecycle", () => {
  const reference = `apify:${"a".repeat(24)}:run_1`;
  afterEach(() => vi.unstubAllEnvs());
  it("checkpoints the owning run reference before polling an Apify-primary order", async () => {
    vi.stubEnv("SCRAPER_PROVIDER", "apify");
    vi.stubEnv("APIFY_FULFILLMENT_ENABLED", "true");
    vi.stubEnv("APIFY_TOKEN", "test-token");
    mocks.apifyDispatch.mockResolvedValue({
      runReference: reference,
      run: { id: "run_1", status: "RUNNING", defaultDatasetId: "dataset_1" },
    });
    mocks.db.leadFulfillmentRun.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(run);
    expect((await processNextFulfillment()).status).toBe("DISPATCHED");
    expect(mocks.trigger).not.toHaveBeenCalled();
    expect(mocks.db.leadFulfillmentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "POLLING", runId: reference },
      }),
    );
  });
  it("resumes polling the pinned Apify run after the default provider changes", async () => {
    mocks.db.leadFulfillmentRun.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...run, status: "POLLING", runId: reference });
    mocks.apifyStatus.mockResolvedValue({
      id: "run_1",
      status: "SUCCEEDED",
      defaultDatasetId: "dataset_1",
    });
    expect((await processNextFulfillment()).status).toBe("INGESTING");
    expect(mocks.apifyStatus).toHaveBeenCalledWith(reference);
    expect(mocks.status).not.toHaveBeenCalled();
  });
  it("ingests Apify leads and checkpoints candidate/cursor without bypassing tier allocation", async () => {
    mocks.db.leadFulfillmentRun.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...run, status: "INGESTING", runId: reference });
    mocks.apifyStatus.mockResolvedValue({
      id: "run_1",
      status: "SUCCEEDED",
      defaultDatasetId: "dataset_1",
    });
    mocks.apifyPage.mockResolvedValue({
      page: 1,
      total_pages: 1,
      total_results: 1,
      data: [{ title: "Compass lead" }],
    });
    mocks.apifyIngest.mockResolvedValue({
      kind: "lead",
      agentId: "apify_agent",
      created: true,
    });
    expect((await processNextFulfillment()).status).toBe("INGESTING");
    expect(mocks.ingest).not.toHaveBeenCalled();
    expect(mocks.db.leadFulfillmentCandidate.createMany).toHaveBeenCalledWith({
      data: [{ jobId: "job-1", agentId: "apify_agent" }],
      skipDuplicates: true,
    });
    expect(mocks.db.unlockedLead.createMany).not.toHaveBeenCalled();
    expect(mocks.db.leadFulfillmentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ resultOffset: 1, processedCount: 1 }),
      }),
    );
  });
  it("keeps ambiguous paid Apify dispatches in NEEDS_REVIEW, never redispatches", async () => {
    vi.stubEnv("SCRAPER_PROVIDER", "apify");
    vi.stubEnv("APIFY_FULFILLMENT_ENABLED", "true");
    vi.stubEnv("APIFY_TOKEN", "test-token");
    mocks.db.leadFulfillmentRun.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(run);
    mocks.apifyDispatch.mockRejectedValue(
      new ApifyError("Lost response", "NETWORK_ERROR", undefined, true),
    );
    expect((await processNextFulfillment()).status).toBe("NEEDS_REVIEW");
    expect(mocks.db.leadFulfillmentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "UNKNOWN" } }),
    );
    expect(mocks.apifyDispatch).toHaveBeenCalledOnce();
  });
});

it("scans beyond N raw Apify rows, completes at exactly N eligible leads, and never refunds", async () => {
  const reference = `apify:${"a".repeat(24)}:run_1`;
  mocks.db.leadFulfillmentRun.findFirst
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ ...run, status: "INGESTING", runId: reference });
  mocks.apifyStatus.mockResolvedValue({
    id: "run_1",
    status: "SUCCEEDED",
    defaultDatasetId: "dataset_1",
  });
  mocks.apifyPage.mockResolvedValue({
    page: 1,
    total_pages: 1,
    total_results: 6,
    data: Array.from({ length: 6 }, (_, i) => ({ title: String(i) })),
  });
  let n = 0;
  mocks.apifyIngest.mockImplementation(async () => {
    n++;
    return n <= 3
      ? { kind: "invalid" }
      : { kind: "lead", agentId: "a" + n, eligible: true };
  });
  mocks.db.leadFulfillmentCandidate.findMany
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ agentId: "a4" }, { agentId: "a5" }]);
  expect((await processNextFulfillment()).status).toBe("COMPLETED");
  expect(mocks.apifyBatch).toHaveBeenCalledOnce();
  expect(mocks.apifyIngest).toHaveBeenCalledTimes(6);
  expect(mocks.db.unlockedLead.createMany).toHaveBeenCalledWith({
    data: [
      { userId: "u1", agentId: "a4", purchaseId: "p1" },
      { userId: "u1", agentId: "a5", purchaseId: "p1" },
    ],
  });
  expect(mocks.db.walletTransaction.create).not.toHaveBeenCalled();
  expect(mocks.failedEmail).not.toHaveBeenCalled();
});
it("validates a historical APIFY candidate without invoking the injected local SMTP verifier", async () => {
  const smtp = vi.fn();
  mocks.db.leadFulfillmentRun.findFirst.mockResolvedValue(null);
  mocks.db.leadFulfillmentCandidate.findMany
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      {
        agentId: "a1",
        nextVerificationAt: new Date(0),
        verificationAttempts: 0,
        agent: {
          id: "a1",
          email: "agent@example.com",
          dataSource: "APIFY",
          emailStatus: "unverified",
        },
      },
    ])
    .mockResolvedValueOnce([{ agentId: "a1" }, { agentId: "a2" }]);
  expect((await processNextFulfillment({ verifyEmail: smtp })).status).toBe(
    "COMPLETED",
  );
  expect(smtp).not.toHaveBeenCalled();
  expect(mocks.db.agent.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        id: "a1",
        dataSource: "APIFY",
        email: "agent@example.com",
      }),
      data: expect.objectContaining({
        emailStatus: "syntax_valid",
        isVerified: false,
      }),
    }),
  );
  expect(mocks.db.walletTransaction.create).not.toHaveBeenCalled();
});
it("preserves buffered Apify ingestion across a persisted cursor instead of treating N processed rows as done", async () => {
  const reference = `apify:${"a".repeat(24)}:run_1`;
  mocks.db.leadFulfillmentRun.findFirst
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({
      ...run,
      status: "INGESTING",
      runId: reference,
      resultOffset: 2,
      processedCount: 2,
    });
  mocks.apifyStatus.mockResolvedValue({
    id: "run_1",
    status: "SUCCEEDED",
    defaultDatasetId: "dataset_1",
  });
  mocks.apifyPage.mockResolvedValue({
    page: 1,
    total_pages: 1,
    total_results: 3,
    data: [{}, {}, { title: "Candidate beyond N" }],
  });
  mocks.apifyIngest.mockResolvedValue({
    kind: "lead",
    agentId: "a3",
    eligible: false,
  });
  expect((await processNextFulfillment()).status).toBe("INGESTING");
  expect(mocks.apifyIngest).toHaveBeenCalledOnce();
  expect(mocks.db.leadFulfillmentRun.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ resultOffset: 3, processedCount: 3 }),
    }),
  );
});

it("does not refund legacy SMTP candidates when no verifier is available", async () => {
  mocks.db.leadFulfillmentRun.findFirst.mockResolvedValue(null);
  mocks.db.leadFulfillmentCandidate.findMany.mockResolvedValue([]);
  mocks.db.leadFulfillmentCandidate.findFirst.mockResolvedValue({
    agentId: "legacy",
  });
  expect((await processNextFulfillment()).status).toBe("WAITING_VERIFICATION");
  expect(mocks.db.leadFulfillmentCandidate.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        agent: expect.objectContaining({
          email: { not: null },
          dataSource: "APIFY",
          NOT: expect.any(Object),
        }),
      }),
    }),
  );
  expect(mocks.db.walletTransaction.create).not.toHaveBeenCalled();
});

vi.mock("@fine-leads/auth", () => ({
  auth: async () => ({ user: { id: "u1" } }),
}));
import { POST as syncOwnedOrder } from "../app/api/purchases/[purchaseId]/sync/route";
it("an owner sync immediately resolves a 72-second-old completed Apify run through the real durable runner", async () => {
  const reference = `apify:${"a".repeat(24)}:run_1`;
  mocks.db.leadPurchase.findFirst
    .mockResolvedValueOnce({
      status: "PROCESSING",
      createdAt: new Date(Date.now() - 72000),
      fulfillmentJob: { id: job.id },
    })
    .mockResolvedValueOnce({ status: "COMPLETED" });
  mocks.db.leadFulfillmentRun.findFirst
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ ...run, status: "POLLING", runId: reference })
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ ...run, status: "INGESTING", runId: reference });
  mocks.apifyStatus.mockResolvedValue({
    id: "run_1",
    status: "SUCCEEDED",
    defaultDatasetId: "dataset_1",
  });
  mocks.apifyPage.mockResolvedValue({
    page: 1,
    total_pages: 1,
    total_results: 20,
    data: Array.from({ length: 20 }, (_, i) => ({ title: "Lead " + i })),
  });
  let n = 0;
  mocks.apifyIngest.mockImplementation(async () => ({
    kind: "lead",
    agentId: "a" + ++n,
    eligible: true,
  }));
  mocks.db.leadFulfillmentCandidate.findMany
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ agentId: "a1" }, { agentId: "a2" }]);
  const response = await syncOwnedOrder(
    new Request("https://app.test/api/purchases/p1/sync", {
      method: "POST",
      headers: { origin: "https://app.test" },
    }),
    { params: Promise.resolve({ purchaseId: "p1" }) },
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    status: "COMPLETED",
    syncStatus: "COMPLETED",
  });
  expect(mocks.apifyStatus).toHaveBeenCalledWith(reference);
  expect(mocks.apifyPage).toHaveBeenCalledWith(reference, 1, 100);
  expect(mocks.apifyBatch).toHaveBeenCalledOnce();
  expect(mocks.apifyIngest).toHaveBeenCalledTimes(20);
  expect(mocks.db.unlockedLead.createMany).toHaveBeenCalledOnce();
  expect(mocks.db.leadPurchase.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({ data: { status: "COMPLETED" } }),
  );
  expect(mocks.apifyDispatch).not.toHaveBeenCalled();
  expect(mocks.db.walletTransaction.create).not.toHaveBeenCalled();
  expect(mocks.failedEmail).not.toHaveBeenCalled();
});

it("completes a ten-lead cold-calling page atomically without per-record cursor transactions", async () => {
  const reference = "apify:" + "a".repeat(24) + ":run_1";
  const phonePurchase = { ...job.purchase, tier: "PHONE_ONLY", leadCount: 10 };
  mocks.db.leadFulfillmentJob.findUniqueOrThrow.mockResolvedValue({
    ...job,
    purchase: phonePurchase,
  });
  mocks.db.leadPurchase.findUniqueOrThrow.mockResolvedValue(phonePurchase);
  mocks.db.leadFulfillmentRun.findFirst
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({
      ...run,
      targetQuantity: 10,
      status: "INGESTING",
      runId: reference,
    });
  mocks.apifyStatus.mockResolvedValue({
    id: "run_1",
    status: "SUCCEEDED",
    defaultDatasetId: "dataset_1",
  });
  mocks.apifyPage.mockResolvedValue({
    page: 1,
    total_pages: 1,
    total_results: 10,
    data: Array.from({ length: 10 }, (_, i) => ({ title: String(i) })),
  });
  let n = 0;
  mocks.apifyIngest.mockImplementation(async () => ({
    kind: "lead",
    agentId: "phone-" + ++n,
    created: true,
    eligible: false,
  }));
  mocks.db.leadFulfillmentCandidate.findMany
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce(
      Array.from({ length: 10 }, (_, i) => ({ agentId: "phone-" + (i + 1) })),
    );
  mocks.db.leadFulfillmentCandidate.createMany.mockImplementation(async () => {
    expect(mocks.transactionActive).toBe(true);
    return { count: 10 };
  });
  mocks.db.unlockedLead.createMany.mockImplementation(async ({ data }) => {
    expect(mocks.transactionActive).toBe(true);
    expect(data).toHaveLength(10);
    return { count: 10 };
  });
  expect((await processNextFulfillment()).status).toBe("COMPLETED");
  expect(mocks.apifyBatch).toHaveBeenCalledOnce();
  expect(mocks.db.$transaction).toHaveBeenCalledTimes(2); // initial inventory check + one atomic page/completion
  expect(mocks.db.leadFulfillmentCandidate.createMany).toHaveBeenCalledOnce();
  expect(mocks.db.leadFulfillmentCandidate.upsert).not.toHaveBeenCalled();
  expect(mocks.db.leadFulfillmentRun.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        status: "DONE",
        resultOffset: 10,
        processedCount: 10,
        newLeadCount: { increment: 10 },
      }),
    }),
  );
  expect(mocks.db.unlockedLead.createMany).toHaveBeenCalledOnce();
  expect(mocks.db.walletTransaction.create).not.toHaveBeenCalled();
});

describe("Apify exact-quota deficit scheduling", () => {
  afterEach(() => vi.unstubAllEnvs());
  const reference = "apify:" + "a".repeat(24) + ":completed_run";
  function activeApifyOrder() {
    const purchase = {
      ...job.purchase,
      lobstrRunId: reference,
      leadCount: 100,
    };
    mocks.db.leadFulfillmentJob.findUniqueOrThrow.mockResolvedValue({
      ...job,
      purchase,
    });
    mocks.db.leadPurchase.findUniqueOrThrow.mockResolvedValue(purchase);
    mocks.db.leadFulfillmentRun.findMany.mockImplementation(
      async ({ select }) =>
        select.id
          ? []
          : [
              {
                state: "TX",
                zipCode: null,
                targetQuantity: 100,
                runId: reference,
              },
            ],
    );
  }
  it("queues only the true deficit on a new durable ZIP, without a refund or partial allocation", async () => {
    activeApifyOrder();
    // initial allocation checks no inventory; scheduling then observes 49 eligible records
    mocks.db.agent.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(
        Array.from({ length: 49 }, (_, i) => ({ id: "email-" + i })),
      );
    expect((await processNextFulfillment()).status).toBe("RETRY_QUEUED");
    expect(mocks.db.leadFulfillmentRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        jobId: job.id,
        targetQuantity: 51,
        status: "QUEUED",
        state: "TX",
        zipCode: expect.stringMatching(/^\d{5}$/),
      }),
    });
    expect(mocks.db.unlockedLead.createMany).not.toHaveBeenCalled();
    expect(mocks.db.walletTransaction.create).not.toHaveBeenCalled();
    expect(mocks.db.leadPurchase.updateMany).not.toHaveBeenCalled();
  });
  it("keeps a retry pinned to Apify and forwards its reserved ZIP", async () => {
    activeApifyOrder();
    mocks.db.leadFulfillmentRun.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...run, zipCode: "78701", targetQuantity: 51 });
    mocks.apifyDispatch.mockResolvedValue({
      runReference: reference,
      run: {
        id: "completed_run",
        status: "RUNNING",
        defaultDatasetId: "dataset",
      },
    });
    expect((await processNextFulfillment()).status).toBe("DISPATCHED");
    expect(mocks.apifyDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        maxPlaces: 51,
        leadTier: "VERIFIED_EMAIL",
        searchStrings: expect.arrayContaining([
          expect.stringContaining("78701"),
        ]),
      }),
    );
    expect(mocks.trigger).not.toHaveBeenCalled();
  });
  it("stops paid loops at the configured ceiling without partially delivering or refunding", async () => {
    activeApifyOrder();
    vi.stubEnv("APIFY_MAX_FULFILLMENT_RUNS", "1");
    expect((await processNextFulfillment()).status).toBe("NEEDS_REVIEW");
    expect(mocks.db.leadFulfillmentRun.create).not.toHaveBeenCalled();
    expect(mocks.db.unlockedLead.createMany).not.toHaveBeenCalled();
    expect(mocks.db.walletTransaction.create).not.toHaveBeenCalled();
  });
  it("never resumes or allocates a refunded order", async () => {
    activeApifyOrder();
    mocks.db.leadFulfillmentJob.findUniqueOrThrow.mockResolvedValue({
      ...job,
      purchase: { ...job.purchase, status: "REFUNDED", lobstrRunId: reference },
    });
    expect((await processNextFulfillment()).status).toBe("REFUNDED");
    expect(mocks.apifyDispatch).not.toHaveBeenCalled();
    expect(mocks.db.unlockedLead.createMany).not.toHaveBeenCalled();
    expect(mocks.db.leadPurchase.updateMany).not.toHaveBeenCalled();
  });
  it("saves overflow pages before committing exact-N allocation", async () => {
    activeApifyOrder();
    mocks.db.leadFulfillmentRun.findMany.mockResolvedValue([{ id: "r1" }]);
    mocks.db.leadFulfillmentRun.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...run,
        status: "INGESTING",
        runId: reference,
        targetQuantity: 1,
      });
    mocks.apifyStatus.mockResolvedValue({
      id: "completed_run",
      status: "SUCCEEDED",
      defaultDatasetId: "dataset",
    });
    mocks.apifyPage.mockResolvedValue({
      page: 1,
      total_pages: 2,
      total_results: 150,
      data: Array.from({ length: 100 }, (_, i) => ({
        title: "candidate-" + i,
      })),
    });
    mocks.apifyIngest.mockImplementation(async () => ({
      kind: "lead",
      agentId: "overflow",
      created: true,
    }));
    expect((await processNextFulfillment()).status).toBe("INGESTING");
    expect(mocks.apifyIngest).toHaveBeenCalledTimes(100);
    expect(mocks.db.leadFulfillmentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resultPage: 2,
          resultOffset: 0,
          processedCount: 100,
          status: "INGESTING",
        }),
      }),
    );
    expect(mocks.db.unlockedLead.createMany).not.toHaveBeenCalled();
  });
});
