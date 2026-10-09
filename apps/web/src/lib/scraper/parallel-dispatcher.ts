import { db, Prisma } from "@fine-leads/database";
import {
  LobstrClient,
  LobstrDispatchError,
  type LobstrBalance,
} from "./lobstr-client";
import {
  availableProviderCapacity,
  nextBackupZip,
  parallelConfigSchema,
  type ParallelConfig,
} from "./parallel-plan";
import { ingestLobstrPages } from "./bulk-ingestion";
import {
  freshInventoryWhere,
  isSmtpDeliverable,
  type EmailVerificationResult,
} from "./fulfillment-policy";
export {
  createParallelPlan,
  parallelFulfillmentEnabled,
  ParallelConfigurationError,
} from "./parallel-plan";

type Job = Prisma.LeadFulfillmentJobGetPayload<{ include: { purchase: true } }>;
type Child = Prisma.LeadFulfillmentRunGetPayload<{
  include: { capacity: true };
}>;
interface Hooks {
  guard: (tx: Prisma.TransactionClient) => Promise<void>;
  complete: () => Promise<boolean>;
  refund: (reason: string) => Promise<unknown>;
  verifyEmail?: (email: string) => Promise<EmailVerificationResult>;
}
const HELD = ["RESERVED", "ACTIVE", "UNKNOWN"];
const terminalProvider = (status: string) =>
  ["DONE", "ERROR", "ABORTED"].includes(status);

export async function concurrentMap<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<R>,
): Promise<Array<PromiseSettledResult<R>>> {
  const results: Array<PromiseSettledResult<R>> = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from(
      { length: Math.min(items.length, Math.max(1, Math.floor(concurrency))) },
      async () => {
        while (cursor < items.length) {
          const index = cursor++;
          try {
            results[index] = {
              status: "fulfilled",
              value: await task(items[index]!),
            };
          } catch (reason) {
            results[index] = { status: "rejected", reason };
          }
        }
      },
    ),
  );
  return results;
}
async function writeChild(
  job: Job,
  hooks: Hooks,
  id: string,
  data: Prisma.LeadFulfillmentRunUpdateInput,
) {
  await db.$transaction(
    async (tx) => {
      await hooks.guard(tx);
      await tx.leadFulfillmentRun.update({ where: { id }, data });
    },
    { timeout: 15_000 },
  );
}

/** Slot/credit reservation is shared across processes; no provider call runs under the DB lock. */
export async function reserveParallelChildren(
  job: Job,
  config: ParallelConfig,
  balance: LobstrBalance,
  hooks: Pick<Hooks, "guard">,
) {
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('fine-leads:lobstr-capacity'))`,
      );
      await hooks.guard(tx);
      const [global, pendingSlots, orderSlots, committed, queued] =
        await Promise.all([
          tx.lobstrCapacityReservation.aggregate({
            where: { status: { in: HELD } },
            _count: { _all: true },
            _sum: { estimatedCredits: true },
          }),
          tx.lobstrCapacityReservation.count({ where: { status: "RESERVED" } }),
          tx.lobstrCapacityReservation.count({
            where: { status: { in: HELD }, run: { jobId: job.id } },
          }),
          tx.lobstrCapacityReservation.aggregate({
            where: { status: { not: "VOID" }, run: { jobId: job.id } },
            _sum: { estimatedCredits: true },
          }),
          tx.leadFulfillmentRun.findMany({
            where: { jobId: job.id, status: "QUEUED" },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: config.concurrency,
            include: { capacity: true },
          }),
        ]);
      const room = availableProviderCapacity(balance, config, {
        globalSlots: global._count._all,
        pendingSlots,
        orderSlots,
        credits: global._sum.estimatedCredits ?? 0,
        committedOrderCredits: committed._sum.estimatedCredits ?? 0,
      });
      const chosen: Child[] = [];
      for (const run of queued) {
        const credits = run.targetQuantity * config.creditsPerResult;
        if (chosen.length >= room.slots) break;
        if (credits > room.credits || run.capacity) continue;
        room.credits -= credits;
        chosen.push(run);
      }
      if (chosen.length) {
        const claimed = await tx.leadFulfillmentRun.updateMany({
          where: {
            id: { in: chosen.map((run) => run.id) },
            jobId: job.id,
            status: "QUEUED",
          },
          data: { status: "DISPATCHING", lastError: null },
        });
        if (claimed.count !== chosen.length)
          throw new Error("PARALLEL_RESERVATION_CONFLICT");
        await tx.lobstrCapacityReservation.createMany({
          data: chosen.map((run) => ({
            runRowId: run.id,
            estimatedCredits: run.targetQuantity * config.creditsPerResult,
          })),
        });
      }
      return chosen;
    },
    { timeout: 20_000 },
  );
}

async function retireSquid(
  client: LobstrClient,
  run: { id: string; squidId: string | null },
  status: "RELEASED" | "VOID",
) {
  if (run.squidId) await client.deactivateSquid(run.squidId);
  await db.lobstrCapacityReservation.updateMany({
    where: { runRowId: run.id, status: { in: HELD } },
    data: { status },
  });
}
async function scheduleBackups(job: Job, hooks: Hooks, config: ParallelConfig) {
  await db.$transaction(
    async (tx) => {
      await hooks.guard(tx);
      const rows = await tx.leadFulfillmentRun.findMany({
        where: { jobId: job.id },
        select: {
          id: true,
          state: true,
          zipCode: true,
          status: true,
          newLeadCount: true,
          targetQuantity: true,
          backupOfId: true,
          backupDepth: true,
        },
      });
      const used = new Set(
        rows.flatMap((row) => (row.zipCode ? [row.zipCode] : [])),
      );
      const replaced = new Set(
        rows.flatMap((row) => (row.backupOfId ? [row.backupOfId] : [])),
      );
      // At most a bounded number of recovery rows per invocation; total chargeable work has a budget cap.
      const backups: Prisma.LeadFulfillmentRunCreateManyInput[] = [];
      for (const row of rows) {
        if (backups.length >= config.concurrency) break;
        if (
          !["FAILED", "DONE"].includes(row.status) ||
          row.newLeadCount >= row.targetQuantity ||
          replaced.has(row.id) ||
          row.backupDepth >= 2
        )
          continue;
        const zipCode = nextBackupZip(row.state, used);
        if (!zipCode) continue;
        used.add(zipCode);
        backups.push({
          jobId: job.id,
          state: row.state,
          zipCode,
          targetQuantity: Math.min(
            config.batchSize,
            Math.max(1, row.targetQuantity - row.newLeadCount),
          ),
          backupOfId: row.id,
          backupDepth: row.backupDepth + 1,
        });
      }
      if (
        !backups.length &&
        !rows.some((row) =>
          ["QUEUED", "DISPATCHING", "POLLING", "INGESTING", "UNKNOWN"].includes(
            row.status,
          ),
        )
      ) {
        const waiting =
          job.purchase.tier === "VERIFIED_EMAIL"
            ? await tx.leadFulfillmentCandidate.count({
                where: {
                  jobId: job.id,
                  verificationDone: false,
                  agent: { email: { not: null } },
                },
              })
            : 0;
        if (!waiting) {
          const eligible = await tx.agent.count({
            where: {
              ...freshInventoryWhere(
                job.purchase.userId,
                job.purchase.unlockedStates,
                job.purchase.tier,
              ),
              fulfillmentCandidates: { some: { jobId: job.id } },
            },
          });
          let shortfall = Math.max(0, job.purchase.leadCount - eligible);
          for (const row of rows) {
            if (shortfall === 0 || backups.length >= config.concurrency) break;
            if (
              !["FAILED", "DONE"].includes(row.status) ||
              replaced.has(row.id) ||
              row.backupDepth >= 2
            )
              continue;
            const zipCode = nextBackupZip(row.state, used);
            if (!zipCode) continue;
            used.add(zipCode);
            const targetQuantity = Math.min(config.batchSize, shortfall);
            backups.push({
              jobId: job.id,
              state: row.state,
              zipCode,
              targetQuantity,
              backupOfId: row.id,
              backupDepth: row.backupDepth + 1,
            });
            shortfall -= targetQuantity;
          }
        }
      }
      if (backups.length)
        await tx.leadFulfillmentRun.createMany({
          data: backups,
          skipDuplicates: true,
        });
    },
    { timeout: 20_000 },
  );
}

async function verifyCandidates(
  job: Job,
  hooks: Hooks,
  config: ParallelConfig,
  deadline: number,
) {
  if (
    job.purchase.tier !== "VERIFIED_EMAIL" ||
    !hooks.verifyEmail ||
    Date.now() + 25_000 >= deadline
  )
    return;
  const candidates = await db.leadFulfillmentCandidate.findMany({
    where: {
      jobId: job.id,
      verificationDone: false,
      nextVerificationAt: { lte: new Date() },
      agent: { email: { not: null } },
    },
    take: 1_000,
    include: { agent: { select: { id: true, email: true } } },
    orderBy: [{ nextVerificationAt: "asc" }, { agentId: "asc" }],
  });
  const checks = await concurrentMap(
    candidates,
    Math.min(10, config.concurrency),
    async (candidate) => {
      if (Date.now() + 20_000 >= deadline) return null;
      const email = candidate.agent.email!;
      const result = await hooks.verifyEmail!(email);
      const good = isSmtpDeliverable(result, email);
      const matching =
        result.email.trim().toLowerCase() === email.trim().toLowerCase();
      const bad =
        matching &&
        [
          "undeliverable",
          "catch-all",
          "disposable",
          "invalid_syntax",
          "no_mx",
        ].includes(result.status);
      return {
        candidate,
        email,
        result,
        good,
        bad,
        terminal: good || bad || candidate.verificationAttempts >= 2,
      };
    },
  );
  const done = checks.flatMap((check) =>
    check.status === "fulfilled" && check.value ? [check.value] : [],
  );
  if (!done.length) return;
  await db.$transaction(
    async (tx) => {
      await hooks.guard(tx);
      const positive = done.filter((check) => check.good);
      if (positive.length)
        await tx.agent.updateMany({
          where: {
            OR: positive.map((check) => ({
              id: check.candidate.agentId,
              email: check.email,
            })),
          },
          data: {
            emailStatus: "deliverable",
            isDeliverable: true,
            isVerified: true,
            lastVerifiedAt: new Date(),
            verificationScore: 100,
          },
        });
      for (const status of [
        "undeliverable",
        "catch-all",
        "disposable",
        "invalid_syntax",
        "no_mx",
      ]) {
        const negative = done.filter(
          (check) => check.bad && check.result.status === status,
        );
        if (negative.length)
          await tx.agent.updateMany({
            where: {
              OR: negative.map((check) => ({
                id: check.candidate.agentId,
                email: check.email,
              })),
            },
            data: {
              emailStatus: status,
              isDeliverable: false,
              isVerified: false,
              lastVerifiedAt: new Date(),
            },
          });
      }
      for (const terminal of [true, false]) {
        const group = done.filter((check) => check.terminal === terminal);
        if (group.length)
          await tx.leadFulfillmentCandidate.updateMany({
            where: {
              jobId: job.id,
              OR: group.map((check) => ({
                agentId: check.candidate.agentId,
                agent: { email: check.email },
              })),
            },
            data: {
              verificationDone: terminal,
              verificationAttempts: { increment: 1 },
              nextVerificationAt: new Date(Date.now() + 60_000),
            },
          });
      }
    },
    { timeout: 20_000 },
  );
}

/** One leased parent coordinator drives independent cloud child runs in parallel. */
export async function advanceParallelJob(
  job: Job,
  hooks: Hooks,
  deadline: number,
) {
  const config = parallelConfigSchema.parse(job.parallelConfig);
  const client = new LobstrClient();
  const interrupted = await db.leadFulfillmentRun.findMany({
    where: { jobId: job.id, status: "DISPATCHING" },
    select: { id: true },
  });
  if (interrupted.length)
    await db.$transaction(async (tx) => {
      await hooks.guard(tx);
      const ids = interrupted.map((run) => run.id);
      await tx.leadFulfillmentRun.updateMany({
        where: { id: { in: ids }, jobId: job.id, status: "DISPATCHING" },
        data: { status: "UNKNOWN", lastError: "DISPATCH_UNCERTAIN" },
      });
      await tx.lobstrCapacityReservation.updateMany({
        where: { runRowId: { in: ids }, status: { in: HELD } },
        data: { status: "UNKNOWN" },
      });
    });
  const running = await db.leadFulfillmentRun.findMany({
    where: { jobId: job.id, status: { in: ["POLLING", "INGESTING"] } },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: config.concurrency,
    include: { capacity: true },
  });
  const exports = await concurrentMap(
    running,
    config.concurrency,
    async (run) => {
      if (Date.now() + 25_000 >= deadline || !run.runId) return null;
      const status = await client.getRunStatus(run.runId);
      if (["ERROR", "ABORTED"].includes(status.status)) {
        await writeChild(job, hooks, run.id, {
          status: "FAILED",
          lastError: "LOBSTR_CHILD_FAILED",
        });
        await retireSquid(client, run, "RELEASED");
        return null;
      }
      if (status.status !== "DONE" || status.export_done !== true) return null;
      const page = await client.getRunResultsPage(
        run.runId,
        run.resultPage,
        100,
      );
      const expected = Math.min(
        100,
        Math.max(0, page.total_results - (run.resultPage - 1) * 100),
      );
      if (page.data.length !== expected)
        throw new Error("INCOMPLETE_CHILD_PAGE");
      return { run, page };
    },
  );
  for (let index = 0; index < exports.length; index++) {
    if (exports[index]?.status === "rejected")
      console.warn("[LOBSTR_PARALLEL_FETCH_RETRY]", {
        purchaseId: job.purchaseId,
        childId: running[index]!.id,
      });
  }
  if (exports.length && exports.every((result) => result.status === "rejected"))
    throw new Error("PARALLEL_FETCH_RETRY");
  const ready = exports.flatMap((result) =>
    result.status === "fulfilled" && result.value ? [result.value] : [],
  );
  for (
    let offset = 0;
    offset < ready.length && Date.now() + 15_000 < deadline;
    offset += 10
  ) {
    const batch = ready.slice(offset, offset + 10);
    await ingestLobstrPages(
      batch.map(({ run, page }) => ({
        records: page.data.slice(run.resultOffset),
        context: { state: run.state, category: job.category },
      })),
      async (tx, result) => {
        for (let index = 0; index < batch.length; index++) {
          const { run, page } = batch[index]!;
          const sourceIds = result.pageAgentIds[index]!;
          // PHONE_ONLY eligibility supplies source quality; FULL additionally needs an email to verify later.
          const sourceWhere = freshInventoryWhere(
            job.purchase.userId,
            job.purchase.unlockedStates,
            "PHONE_ONLY",
          );
          const candidates = sourceIds.length
            ? await tx.agent.findMany({
                where: {
                  ...sourceWhere,
                  id: { in: sourceIds },
                  ...(job.purchase.tier === "VERIFIED_EMAIL"
                    ? { email: { not: null } }
                    : {}),
                },
                select: { id: true },
              })
            : [];
          const added = candidates.length
            ? await tx.leadFulfillmentCandidate.createMany({
                data: candidates.map((agent) => ({
                  jobId: job.id,
                  agentId: agent.id,
                })),
                skipDuplicates: true,
              })
            : { count: 0 };
          const done =
            page.total_pages === 0 || run.resultPage >= page.total_pages;
          await tx.leadFulfillmentRun.update({
            where: { id: run.id },
            data: {
              status: done ? "DONE" : "INGESTING",
              resultPage: done ? run.resultPage : run.resultPage + 1,
              resultOffset: 0,
              processedCount: {
                increment: page.data.length - run.resultOffset,
              },
              newLeadCount: { increment: added.count },
              lastError: null,
            },
          });
        }
      },
      hooks.guard,
    );
    // Slots are released only after the result-page/candidate transaction commits.
    await concurrentMap(
      batch.filter(
        ({ run, page }) =>
          page.total_pages === 0 || run.resultPage >= page.total_pages,
      ),
      config.concurrency,
      ({ run }) => retireSquid(client, run, "RELEASED"),
    );
    if (await hooks.complete()) return { status: "COMPLETED", delayMs: 0 };
  }
  if (await hooks.complete()) return { status: "COMPLETED", delayMs: 0 };
  await verifyCandidates(job, hooks, config, deadline);
  if (await hooks.complete()) return { status: "COMPLETED", delayMs: 0 };
  if (Date.now() + 35_000 < deadline) {
    await scheduleBackups(job, hooks, config);
    const queued = await db.leadFulfillmentRun.count({
      where: { jobId: job.id, status: "QUEUED" },
    });
    if (queued) {
      const balance = await client.getBalance();
      const selected = await reserveParallelChildren(
        job,
        config,
        balance,
        hooks,
      );
      await concurrentMap(selected, config.concurrency, async (run) => {
        let squidId: string | null = null;
        let observedRunId: string | null = null;
        try {
          const sent = await client.triggerScrapeRun(
            {
              state: run.state,
              zipCode: run.zipCode ?? undefined,
              category: job.category,
              limit: run.targetQuantity,
            },
            {
              onSquidCreated: async (id) => {
                squidId = id;
                await writeChild(job, hooks, run.id, { squidId: id });
              },
            },
          );
          observedRunId = sent.id;
          await db.$transaction(
            async (tx) => {
              await hooks.guard(tx);
              await tx.leadFulfillmentRun.update({
                where: { id: run.id },
                data: {
                  status: "POLLING",
                  runId: sent.id,
                  squidId: sent.squid ?? squidId,
                  lastError: null,
                },
              });
              await tx.lobstrCapacityReservation.updateMany({
                where: { runRowId: run.id, status: "RESERVED" },
                data: { status: "ACTIVE" },
              });
              await tx.leadPurchase.update({
                where: { id: job.purchaseId },
                data: { lobstrRunId: sent.id },
              });
            },
            { timeout: 15_000 },
          );
        } catch (error) {
          const uncertain =
            !observedRunId &&
            (!(error instanceof LobstrDispatchError) || error.uncertain);
          console.error("[LOBSTR_PARALLEL_CHILD_FAILED]", {
            purchaseId: job.purchaseId,
            childId: run.id,
            phase:
              error instanceof LobstrDispatchError
                ? error.phase
                : "PERSISTENCE",
            httpStatus:
              error instanceof LobstrDispatchError ? error.status : undefined,
            code:
              error instanceof LobstrDispatchError
                ? error.code
                : "DISPATCH_UNCERTAIN",
            runId: observedRunId,
            squidId,
            uncertain,
          });
          if (observedRunId) {
            await writeChild(job, hooks, run.id, {
              status: "POLLING",
              runId: observedRunId,
              squidId,
              lastError: "DISPATCH_PERSISTENCE_RETRY",
            });
            await db.lobstrCapacityReservation.updateMany({
              where: { runRowId: run.id, status: { in: HELD } },
              data: { status: "ACTIVE" },
            });
            return;
          }
          await writeChild(job, hooks, run.id, {
            status: uncertain ? "UNKNOWN" : "FAILED",
            squidId:
              error instanceof LobstrDispatchError
                ? (error.squidId ?? squidId)
                : squidId,
            lastError: uncertain
              ? "DISPATCH_UNCERTAIN"
              : "CHILD_DISPATCH_REJECTED",
          });
          if (uncertain)
            await db.lobstrCapacityReservation.updateMany({
              where: { runRowId: run.id, status: { in: HELD } },
              data: { status: "UNKNOWN" },
            });
          else
            await retireSquid(
              client,
              {
                id: run.id,
                squidId:
                  error instanceof LobstrDispatchError
                    ? (error.squidId ?? squidId)
                    : squidId,
              },
              "VOID",
            );
        }
      });
    }
  }
  const [active, unknown, waiting, committed] = await Promise.all([
    db.leadFulfillmentRun.count({
      where: {
        jobId: job.id,
        status: { in: ["QUEUED", "DISPATCHING", "POLLING", "INGESTING"] },
      },
    }),
    db.leadFulfillmentRun.count({
      where: { jobId: job.id, status: "UNKNOWN" },
    }),
    db.leadFulfillmentCandidate.count({
      where: {
        jobId: job.id,
        verificationDone: false,
        agent: { email: { not: null } },
      },
    }),
    db.lobstrCapacityReservation.aggregate({
      where: { status: { not: "VOID" }, run: { jobId: job.id } },
      _sum: { estimatedCredits: true },
    }),
  ]);
  if (!active && !unknown && (!waiting || job.purchase.tier === "PHONE_ONLY")) {
    await hooks.refund("PARALLEL_QUALIFIED_INVENTORY_EXHAUSTED");
    return { status: "REFUNDED", delayMs: 0 };
  }
  // Queued work with an exhausted per-order budget cannot consume credits indefinitely.
  const cheapest = await db.leadFulfillmentRun.aggregate({
    where: { jobId: job.id, status: "QUEUED" },
    _min: { targetQuantity: true },
  });
  const remainingBudget =
    config.maxProviderCredits - (committed._sum.estimatedCredits ?? 0);
  const runningCount = await db.leadFulfillmentRun.count({
    where: {
      jobId: job.id,
      status: { in: ["DISPATCHING", "POLLING", "INGESTING"] },
    },
  });
  if (
    !runningCount &&
    !unknown &&
    (remainingBudget <= 0 ||
      (cheapest._min.targetQuantity !== null &&
        cheapest._min.targetQuantity * config.creditsPerResult >
          remainingBudget)) &&
    (!waiting || job.purchase.tier === "PHONE_ONLY")
  ) {
    await hooks.refund("PARALLEL_PROVIDER_BUDGET_EXHAUSTED");
    return { status: "REFUNDED", delayMs: 0 };
  }
  return {
    status:
      unknown && !active
        ? "NEEDS_REVIEW"
        : waiting && !hooks.verifyEmail && !active
          ? "WAITING_VERIFICATION"
          : "PARALLEL_PROGRESS",
    delayMs: 5_000,
  };
}

/** Drain only our terminal child Squids; UNKNOWN paid requests remain held for operator review. */
export async function maintainParallelCapacity(limit = 10) {
  const rows = await db.lobstrCapacityReservation.findMany({
    where: {
      status: { in: HELD },
      run: {
        OR: [
          { status: { in: ["DONE", "FAILED"] } },
          { job: { purchase: { status: { not: "PROCESSING" } } } },
        ],
      },
    },
    include: { run: true },
    take: limit,
    orderBy: { updatedAt: "asc" },
  });
  if (!rows.length) return;
  const client = new LobstrClient();
  await concurrentMap(rows, 5, async (row) => {
    const run = row.run;
    if (
      (!run.runId && row.status === "UNKNOWN") ||
      (!run.runId &&
        row.status === "RESERVED" &&
        run.lastError !== "CHILD_DISPATCH_REJECTED")
    )
      return;
    if (run.runId) {
      const status = await client.getRunStatus(run.runId);
      if (!terminalProvider(status.status)) {
        await client.abortRun(run.runId);
        return; // Confirm terminal status on a later invocation before releasing the reservation.
      }
      await retireSquid(client, run, "RELEASED");
    } else if (run.squidId) await retireSquid(client, run, "VOID");
  });
}
