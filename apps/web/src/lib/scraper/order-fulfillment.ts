import { randomUUID } from "node:crypto";
import { db, Prisma } from "@fine-leads/database";
import { getLeadCreditCost, generateTxnRef } from "@fine-leads/utils";
import { LobstrClient, LobstrError } from "./lobstr-client";
import { ingestLobstrLead } from "./lead-mapper";
import {
  freshInventoryWhere,
  isSmtpDeliverable,
  type EmailVerificationResult,
} from "./fulfillment-policy";

type Job = Prisma.LeadFulfillmentJobGetPayload<{ include: { purchase: true } }>;
const LEASE_MS = 180_000;
const PAGE_SIZE = 100;
const ACTIVE_STATUSES = ["QUEUED", "ACTIVE", "NEEDS_REVIEW"];
export class FulfillmentLeaseLost extends Error {}

async function guardLease(
  tx: Prisma.TransactionClient,
  job: Job,
  token: string,
) {
  const guard = await tx.leadFulfillmentJob.updateMany({
    where: {
      id: job.id,
      status: "ACTIVE",
      leaseToken: token,
      leaseUntil: { gt: new Date() },
    },
    data: { leaseUntil: new Date(Date.now() + LEASE_MS) },
  });
  if (guard.count !== 1)
    throw new FulfillmentLeaseLost("Fulfillment lease lost");
}

/** One atomic completion: status, entitlements and hold settlement commit together. */
export async function completeFulfillment(
  job: Job,
  token: string,
): Promise<boolean> {
  return db.$transaction(
    async (tx) => {
      await guardLease(tx, job, token);
      const purchase = await tx.leadPurchase.findUniqueOrThrow({
        where: { id: job.purchaseId },
      });
      if (purchase.status !== "PROCESSING") return false;
      const where = freshInventoryWhere(
        purchase.userId,
        purchase.unlockedStates,
        purchase.tier,
      );
      // Prefer results associated with this job; top up from fresh shared inventory.
      const candidates = await tx.leadFulfillmentCandidate.findMany({
        where: { jobId: job.id, agent: where },
        take: purchase.leadCount,
        select: { agentId: true },
      });
      const ids = candidates.map((candidate) => candidate.agentId);
      if (ids.length < purchase.leadCount) {
        const inventory = await tx.agent.findMany({
          where: { ...where, id: { notIn: [...ids] } },
          take: purchase.leadCount - ids.length,
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          select: { id: true },
        });
        ids.push(...inventory.map((agent) => agent.id));
      }
      if (ids.length !== purchase.leadCount) return false;
      const changed = await tx.leadPurchase.updateMany({
        where: { id: purchase.id, status: "PROCESSING" },
        data: { status: "COMPLETED" },
      });
      if (changed.count !== 1) return false;
      // No skipDuplicates: a concurrent unlock must roll back and reselect, not short-fill an order.
      await tx.unlockedLead.createMany({
        data: ids.map((agentId) => ({
          userId: purchase.userId,
          agentId,
          purchaseId: purchase.id,
        })),
      });
      await tx.walletTransaction.updateMany({
        where: {
          userId: purchase.userId,
          type: "PURCHASE",
          metadata: { path: ["purchaseId"], equals: purchase.id },
        },
        data: {
          metadata: {
            purchaseId: purchase.id,
            tier: purchase.tier,
            leadCount: purchase.leadCount,
            creditsSpent: job.creditsHeld,
            creditsPerLead: getLeadCreditCost(1, purchase.tier),
            fulfillmentStatus: "COMPLETED",
          },
        },
      });
      await tx.leadFulfillmentJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          leaseToken: null,
          leaseUntil: null,
          lastError: null,
        },
      });
      return true;
    },
    { timeout: 30_000 },
  );
}

/** Conditional PROCESSING transition makes the full refund exactly-once. */
export async function refundFulfillment(
  job: Job,
  token: string,
  reason: string,
) {
  return db.$transaction(
    async (tx) => {
      await guardLease(tx, job, token);
      const changed = await tx.leadPurchase.updateMany({
        where: { id: job.purchaseId, status: "PROCESSING" },
        data: { status: "REFUNDED", refundedAt: new Date() },
      });
      if (changed.count === 1) {
        const user = await tx.user.update({
          where: { id: job.purchase.userId },
          data: { credits: { increment: job.creditsHeld } },
          select: { credits: true },
        });
        await tx.walletTransaction.create({
          data: {
            userId: job.purchase.userId,
            referenceId: generateTxnRef(),
            type: "REFUND",
            amount: job.creditsHeld,
            balanceAfter: user.credits,
            status: "COMPLETED",
            description: "Unfulfilled Lobstr order: credit hold released",
            metadata: {
              purchaseId: job.purchaseId,
              creditsRefunded: job.creditsHeld,
              reason,
            },
          },
        });
        await tx.unlockedLead.deleteMany({
          where: { purchaseId: job.purchaseId },
        });
      }
      await tx.leadFulfillmentJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          lastError: reason,
          leaseToken: null,
          leaseUntil: null,
        },
      });
      return changed.count === 1;
    },
    { timeout: 30_000 },
  );
}

async function persistRun(
  job: Job,
  token: string,
  id: string,
  data: Prisma.LeadFulfillmentRunUpdateInput,
  runId?: string,
) {
  await db.$transaction(
    async (tx) => {
      await guardLease(tx, job, token);
      await tx.leadFulfillmentRun.update({ where: { id }, data });
      if (runId)
        await tx.leadPurchase.update({
          where: { id: job.purchaseId },
          data: { lobstrRunId: runId },
        });
    },
    { timeout: 15_000 },
  );
}

export interface FulfillmentOptions {
  verifyEmail?: (email: string) => Promise<EmailVerificationResult>;
  budgetMs?: number;
  purchaseId?: string;
}

/** Claim one durable job and advance one bounded stage. Safe across worker instances/restarts. */
export async function processNextFulfillment(options: FulfillmentOptions = {}) {
  const now = new Date();
  const available = {
    ...(options.purchaseId ? { purchaseId: options.purchaseId } : {}),
    status: { in: ACTIVE_STATUSES },
    nextAttemptAt: { lte: now },
    OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
  };
  const pending = await db.leadFulfillmentJob.findFirst({
    where: available,
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
  });
  if (!pending) return { worked: false, status: "IDLE" };
  const token = randomUUID();
  const claimed = await db.leadFulfillmentJob.updateMany({
    where: { id: pending.id, ...available },
    data: {
      status: "ACTIVE",
      leaseToken: token,
      leaseUntil: new Date(Date.now() + LEASE_MS),
    },
  });
  if (claimed.count !== 1) return { worked: false, status: "BUSY" };
  const job = await db.leadFulfillmentJob.findUniqueOrThrow({
    where: { id: pending.id },
    include: { purchase: true },
  });
  const deadline = Date.now() + Math.min(options.budgetMs ?? 70_000, 90_000);
  let nextDelay = 0;
  let nextStatus = "ACTIVE";
  let errorCode: string | null = null;
  let outcome = "PROCESSING";
  try {
    if (job.purchase.status !== "PROCESSING") {
      nextStatus = job.purchase.status === "COMPLETED" ? "COMPLETED" : "FAILED";
      return {
        worked: true,
        purchaseId: job.purchaseId,
        status: job.purchase.status,
      };
    }
    if (job.expiresAt <= now) {
      await refundFulfillment(job, token, "FULFILLMENT_EXPIRED");
      return { worked: true, purchaseId: job.purchaseId, status: "REFUNDED" };
    }
    if (await completeFulfillment(job, token))
      return { worked: true, purchaseId: job.purchaseId, status: "COMPLETED" };
    const ambiguous = await db.leadFulfillmentRun.findFirst({
      where: { jobId: job.id, status: { in: ["DISPATCHING", "UNKNOWN"] } },
    });
    if (ambiguous) {
      // Lobstr has no documented idempotency key. Never repeat a possibly-successful paid POST.
      if (ambiguous.status === "DISPATCHING")
        await persistRun(job, token, ambiguous.id, { status: "UNKNOWN" });
      nextStatus = "NEEDS_REVIEW";
      nextDelay = 60_000;
      errorCode = "DISPATCH_UNCERTAIN";
      return {
        worked: true,
        purchaseId: job.purchaseId,
        status: "NEEDS_REVIEW",
      };
    }
    const run = await db.leadFulfillmentRun.findFirst({
      where: { jobId: job.id, status: { notIn: ["DONE", "FAILED"] } },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    });
    if (run?.status === "QUEUED") {
      const client = new LobstrClient();
      await persistRun(job, token, run.id, { status: "DISPATCHING" });
      try {
        const dispatched = await client.triggerScrapeRun({
          state: run.state,
          category: job.category,
          limit: run.targetQuantity,
        });
        await persistRun(
          job,
          token,
          run.id,
          { status: "POLLING", runId: dispatched.id },
          dispatched.id,
        );
        outcome = "DISPATCHED";
      } catch (error) {
        if (error instanceof FulfillmentLeaseLost) throw error;
        await persistRun(job, token, run.id, { status: "UNKNOWN" });
        nextStatus = "NEEDS_REVIEW";
        nextDelay = 60_000;
        errorCode = "DISPATCH_UNCERTAIN";
        outcome = "NEEDS_REVIEW";
      }
    } else if (run?.status === "POLLING" && run.runId) {
      const status = await new LobstrClient().getRunStatus(run.runId);
      if (["ERROR", "ABORTED"].includes(status.status)) {
        await persistRun(job, token, run.id, { status: "FAILED" });
        await refundFulfillment(job, token, "LOBSTR_RUN_FAILED");
        return { worked: true, purchaseId: job.purchaseId, status: "REFUNDED" };
      }
      if (status.status === "DONE" && status.export_done === true) {
        await persistRun(job, token, run.id, { status: "INGESTING" });
        outcome = "INGESTING";
      } else {
        nextDelay = 15_000;
        outcome = "POLLING";
      }
    } else if (run?.status === "INGESTING" && run.runId) {
      const client = new LobstrClient();
      const status = await client.getRunStatus(run.runId);
      if (status.status !== "DONE" || status.export_done !== true)
        throw new LobstrError("Run export is not ready");
      const page = await client.getRunResultsPage(
        run.runId,
        run.resultPage,
        PAGE_SIZE,
      );
      const expectedOnPage = Math.min(
        PAGE_SIZE,
        Math.max(0, page.total_results - (run.resultPage - 1) * PAGE_SIZE),
      );
      if (page.data.length !== expectedOnPage)
        throw new LobstrError("Incomplete run results page");
      let offset = run.resultOffset;
      let processed = run.processedCount;
      while (
        offset < page.data.length &&
        processed < run.targetQuantity &&
        Date.now() + 25_000 < deadline
      ) {
        const mapped = await ingestLobstrLead(page.data[offset]!, {
          state: run.state,
          category: job.category,
        });
        offset++;
        processed++;
        // Candidate association and cursor are committed together. Replays reconnect duplicate IDs.
        await db.$transaction(
          async (tx) => {
            await guardLease(tx, job, token);
            if (mapped.kind === "lead" && mapped.agentId)
              await tx.leadFulfillmentCandidate.upsert({
                where: {
                  jobId_agentId: { jobId: job.id, agentId: mapped.agentId },
                },
                create: { jobId: job.id, agentId: mapped.agentId },
                update: {},
              });
            await tx.leadFulfillmentRun.update({
              where: { id: run.id },
              data: { resultOffset: offset, processedCount: processed },
            });
          },
          { timeout: 15_000 },
        );
      }
      if (processed >= run.targetQuantity || offset >= page.data.length) {
        const done =
          processed >= run.targetQuantity || run.resultPage >= page.total_pages;
        await persistRun(job, token, run.id, {
          status: done ? "DONE" : "INGESTING",
          resultPage: done ? run.resultPage : run.resultPage + 1,
          resultOffset: done ? offset : 0,
        });
      }
      outcome = "INGESTING";
    } else if (!run) {
      if (job.purchase.tier === "PHONE_ONLY") {
        await refundFulfillment(job, token, "INSUFFICIENT_QUALIFIED_RESULTS");
        return { worked: true, purchaseId: job.purchaseId, status: "REFUNDED" };
      }
      const waiting = await db.leadFulfillmentCandidate.findMany({
        where: {
          jobId: job.id,
          verificationDone: false,
          agent: { email: { not: null } },
        },
        take: 3,
        include: { agent: { select: { id: true, email: true } } },
        orderBy: { nextVerificationAt: "asc" },
      });
      if (!waiting.length) {
        await refundFulfillment(job, token, "INSUFFICIENT_VERIFIED_RESULTS");
        return { worked: true, purchaseId: job.purchaseId, status: "REFUNDED" };
      }
      if (!options.verifyEmail) {
        nextDelay = 30_000;
        outcome = "WAITING_VERIFICATION";
      } else {
        const verifier = options.verifyEmail;
        for (const candidate of waiting) {
          if (
            candidate.nextVerificationAt > new Date() ||
            Date.now() + 20_000 >= deadline
          )
            continue;
          const email = candidate.agent.email!;
          const result = await verifier(email);
          const verified = isSmtpDeliverable(result, email);
          const terminal =
            verified ||
            [
              "undeliverable",
              "catch-all",
              "disposable",
              "invalid_syntax",
              "no_mx",
            ].includes(result.status) ||
            candidate.verificationAttempts >= 2;
          await db.$transaction(
            async (tx) => {
              await guardLease(tx, job, token);
              if (verified)
                await tx.agent.updateMany({
                  where: { id: candidate.agentId, email },
                  data: {
                    emailStatus: "deliverable",
                    isDeliverable: true,
                    isVerified: true,
                    lastVerifiedAt: new Date(),
                    verificationScore: 100,
                  },
                });
              // A previously verified but stale duplicate also needs re-verification. Never
              // treat MX-only results as proof, or overwrite evidence for a different email.
              const hardFailure = [
                "undeliverable",
                "catch-all",
                "disposable",
                "invalid_syntax",
                "no_mx",
              ].includes(result.status);
              if (
                !verified &&
                hardFailure &&
                result.email.trim().toLowerCase() === email.trim().toLowerCase()
              ) {
                await tx.agent.updateMany({
                  where: { id: candidate.agentId, email },
                  data: {
                    emailStatus: result.status,
                    isDeliverable: false,
                    isVerified: false,
                    lastVerifiedAt: new Date(),
                  },
                });
              }
              await tx.leadFulfillmentCandidate.update({
                where: {
                  jobId_agentId: { jobId: job.id, agentId: candidate.agentId },
                },
                data: {
                  verificationDone: terminal,
                  verificationAttempts: { increment: 1 },
                  nextVerificationAt: new Date(Date.now() + 60_000),
                },
              });
            },
            { timeout: 15_000 },
          );
        }
        if (await completeFulfillment(job, token))
          return {
            worked: true,
            purchaseId: job.purchaseId,
            status: "COMPLETED",
          };
        outcome = "VERIFYING";
        nextDelay = 10_000;
      }
    } else throw new Error("Invalid fulfillment run state");
    return { worked: true, purchaseId: job.purchaseId, status: outcome };
  } catch (error) {
    if (error instanceof FulfillmentLeaseLost)
      return { worked: false, status: "LEASE_LOST" };
    errorCode =
      error instanceof LobstrError
        ? "LOBSTR_UPSTREAM_ERROR"
        : "FULFILLMENT_RETRY";
    if (job.failureCount >= 7) {
      await refundFulfillment(job, token, "FULFILLMENT_RETRIES_EXHAUSTED");
      return { worked: true, purchaseId: job.purchaseId, status: "REFUNDED" };
    }
    nextDelay = Math.min(300_000, 5_000 * 2 ** job.failureCount);
    return { worked: true, purchaseId: job.purchaseId, status: "RETRYING" };
  } finally {
    await db.leadFulfillmentJob.updateMany({
      where: { id: job.id, leaseToken: token, status: "ACTIVE" },
      data: {
        status: nextStatus,
        nextAttemptAt: new Date(Date.now() + nextDelay),
        leaseToken: null,
        leaseUntil: null,
        lastError: errorCode,
        failureCount:
          errorCode && nextStatus !== "NEEDS_REVIEW" ? { increment: 1 } : 0,
      },
    });
  }
}
