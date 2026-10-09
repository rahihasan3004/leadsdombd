import { redirect } from "next/navigation";
import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";
import { LEAD_STATES } from "@fine-leads/utils";
import {
  ExportsClient,
  type ExportDisplayStatus,
  type ExportHistoryRow,
  type ExportableState,
} from "./exports-client";

export const dynamic = "force-dynamic";

const STATE_NAMES = new Map(LEAD_STATES.map((s) => [s.code, s.name]));
/** Streams that never reached COMPLETED/FAILED (e.g. tab closed mid-download). */
const STALE_PROCESSING_MS = 10 * 60 * 1000;

function displayStatus(status: string, createdAt: Date): ExportDisplayStatus {
  switch (status) {
    case "COMPLETED":
      return "Completed";
    case "FAILED":
      return "Failed";
    case "PROCESSING":
      return Date.now() - createdAt.getTime() > STALE_PROCESSING_MS ? "Incomplete" : "Processing";
    default:
      return "Pending";
  }
}

function stateFromQuery(searchQuery: unknown): string | null {
  if (searchQuery && typeof searchQuery === "object" && "state" in searchQuery) {
    const state = (searchQuery as { state?: unknown }).state;
    return typeof state === "string" ? state.toUpperCase() : null;
  }
  return null;
}

export default async function ExportsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const [purchases, leadCounts, exports] = await Promise.all([
    db.leadPurchase.findMany({
      where: { userId, status: "COMPLETED" },
      select: { unlockedStates: true },
    }),
    // Same filter as /api/exports/stream, so counts match what the CSV contains.
    db.agent.groupBy({
      by: ["state"],
      where: { email: { not: null }, isDeliverable: true, unlockedBy: { some: { userId } } },
      _count: { _all: true },
    }),
    db.leadExport.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, agentCount: true, status: true, searchQuery: true, createdAt: true },
    }),
  ]);

  const countByState = new Map(
    leadCounts.filter((row) => row.state).map((row) => [row.state!.toUpperCase(), row._count._all]),
  );
  const purchasedCodes = new Set(purchases.flatMap((p) => p.unlockedStates).map((s) => s.toUpperCase()));

  const states: ExportableState[] = [...purchasedCodes]
    .filter((code) => STATE_NAMES.has(code))
    .map((code) => ({ code, name: STATE_NAMES.get(code)!, leadCount: countByState.get(code) ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const history: ExportHistoryRow[] = exports.map((e) => {
    const code = stateFromQuery(e.searchQuery);
    return {
      id: e.id,
      stateLabel: code ? (STATE_NAMES.get(code) ?? code) : "—",
      agentCount: e.agentCount,
      status: displayStatus(e.status, e.createdAt),
      createdAt: e.createdAt.toISOString(),
    };
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
          Lead Exports
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Download your unlocked, verified agent lists as CSV.
        </p>
      </div>
      <ExportsClient states={states} history={history} />
    </div>
  );
}
