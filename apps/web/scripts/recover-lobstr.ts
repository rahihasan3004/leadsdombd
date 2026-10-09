import { randomUUID } from "node:crypto";
import { db } from "@fine-leads/database";
import { LEAD_STATES } from "@fine-leads/utils";
import { LobstrClient, LobstrError } from "../src/lib/scraper/lobstr-client";
import {
  ingestLobstrLead,
  mapLobstrLead,
} from "../src/lib/scraper/lead-mapper";
import { refundFulfillment } from "../src/lib/scraper/order-fulfillment";

// Operator-only CLI. Never expose this as a public route or accept arbitrary webhook results.
const args = process.argv.slice(2);
const option = (name: string) => args[args.indexOf(name) + 1];
async function main() {
  if (args[0] === "refund") {
    const referenceId = option("--reference");
    if (
      !args.includes("--reference") ||
      !referenceId ||
      !args.includes("--confirm-no-run")
    )
      throw new Error("Reference and explicit --confirm-no-run are required");
    const job = await db.leadFulfillmentJob.findFirst({
      where: { purchase: { referenceId } },
      include: { purchase: true },
    });
    if (!job) throw new Error("Order fulfillment job not found");
    if (job.purchase.status === "REFUNDED") {
      console.log(JSON.stringify({ referenceId, status: "ALREADY_REFUNDED" }));
      return;
    }
    if (job.purchase.status !== "PROCESSING")
      throw new Error("Only processing orders can be refunded");
    const hold = await db.walletTransaction.findFirst({
      where: {
        userId: job.purchase.userId,
        type: "PURCHASE",
        metadata: { path: ["purchaseId"], equals: job.purchaseId },
      },
      select: { amount: true },
    });
    if (!hold || !hold.amount.equals(-job.creditsHeld) || job.creditsHeld <= 0)
      throw new Error("Hold reconciliation failed");
    const token = randomUUID();
    const claimed = await db.leadFulfillmentJob.updateMany({
      where: {
        id: job.id,
        purchase: { status: "PROCESSING" },
        status: { in: ["QUEUED", "ACTIVE", "NEEDS_REVIEW"] },
        OR: [{ leaseUntil: null }, { leaseUntil: { lte: new Date() } }],
      },
      data: {
        status: "ACTIVE",
        leaseToken: token,
        leaseUntil: new Date(Date.now() + 180_000),
      },
    });
    if (claimed.count !== 1)
      throw new Error(
        "Job is busy or was already settled; retry after its lease expires",
      );
    try {
      await refundFulfillment(job, token, "OPERATOR_CONFIRMED_NO_LOBSTR_RUN");
    } finally {
      await db.leadFulfillmentJob.updateMany({
        where: { id: job.id, status: "ACTIVE", leaseToken: token },
        data: { leaseToken: null, leaseUntil: null, nextAttemptAt: new Date() },
      });
    }
    const ledger = await db.walletTransaction.findFirst({
      where: {
        userId: job.purchase.userId,
        type: "REFUND",
        metadata: { path: ["purchaseId"], equals: job.purchaseId },
      },
      orderBy: { createdAt: "desc" },
      select: { amount: true, balanceAfter: true },
    });
    const settled = await db.leadPurchase.findUniqueOrThrow({
      where: { id: job.purchaseId },
      select: { status: true, refundedAt: true },
    });
    const email = await db.orderEmailNotification.findUnique({
      where: {
        purchaseId_kind: { purchaseId: job.purchaseId, kind: "FAILED" },
      },
      select: { status: true, lastError: true },
    });
    console.log(
      JSON.stringify({
        referenceId,
        ...settled,
        creditsRefunded: ledger?.amount.toNumber(),
        walletBalanceAfter: ledger?.balanceAfter,
        notification: email,
      }),
    );
  } else if (args[0] === "ingest") {
    const runId = option("--run");
    const squidId = option("--squid");
    if (
      !args.includes("--run") ||
      !args.includes("--squid") ||
      !runId ||
      !squidId
    )
      throw new Error("Run and squid IDs are required");
    const client = new LobstrClient();
    const run = await client.getRunStatus(runId);
    if (run.squid !== squidId)
      throw new Error("Run/squid association mismatch");
    const records = await client.getRunResults(runId);
    const summary = {
      runId,
      totalFetched: records.length,
      newlyIngested: 0,
      duplicatesSkipped: 0,
      closedPlacesDiscarded: 0,
      invalidRecordsDiscarded: 0,
      sourceEmailCount: 0,
      eligibleRecords: 0,
      distinctAgentsSaved: 0,
      dryRun: args.includes("--dry-run"),
      states: {} as Record<string, number>,
    };
    const savedIds = new Set<string>();
    for (const record of records) {
      const fields = new Map(
        Object.entries(record).map(([key, value]) => [
          key.toLowerCase().replace(/[^a-z0-9]/g, ""),
          value,
        ]),
      );
      const rawState = fields.get("statecode") ?? fields.get("state");
      const state =
        typeof rawState === "string"
          ? LEAD_STATES.find(
              (state) =>
                state.code === rawState.trim().toUpperCase() ||
                state.name.toLowerCase() === rawState.trim().toLowerCase(),
            )?.code
          : undefined;
      if (!state) {
        summary.invalidRecordsDiscarded++;
        continue;
      }
      summary.states[state] = (summary.states[state] ?? 0) + 1;
      const context = { state, category: "real estate agents" };
      const normalized = { ...record, "State Code": state };
      const mapped = mapLobstrLead(normalized, context);
      if (mapped.kind === "lead") {
        summary.sourceEmailCount += mapped.lead.emails.length;
        summary.eligibleRecords++;
      }
      const result = summary.dryRun
        ? mapped
        : await ingestLobstrLead(normalized, context);
      if (result.kind === "closed") summary.closedPlacesDiscarded++;
      else if (result.kind === "invalid") summary.invalidRecordsDiscarded++;
      else if (summary.dryRun) continue;
      else if ("created" in result && !result.created)
        summary.duplicatesSkipped++;
      else summary.newlyIngested++;
      if (
        result.kind === "lead" &&
        "agentId" in result &&
        typeof result.agentId === "string"
      )
        savedIds.add(result.agentId);
    }
    summary.distinctAgentsSaved = savedIds.size;
    // Summaries only: no raw scraped contacts, tokens or customer details in terminal output.
    console.log(JSON.stringify(summary));
  } else throw new Error("Use refund or ingest");
}
void main()
  .catch((error: unknown) => {
    const safeMessages = [
      "Reference and explicit --confirm-no-run are required",
      "Order fulfillment job not found",
      "Only processing orders can be refunded",
      "Hold reconciliation failed",
      "Job is busy or was already settled; retry after its lease expires",
      "Run and squid IDs are required",
      "Run/squid association mismatch",
      "Use refund or ingest",
    ];
    console.error("[LOBSTR_RECOVERY_FAILED]", {
      code:
        error instanceof LobstrError
          ? error.code
          : error instanceof Error && safeMessages.includes(error.message)
            ? error.message
            : "RECOVERY_ERROR",
      httpStatus: error instanceof LobstrError ? error.status : undefined,
    });
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
