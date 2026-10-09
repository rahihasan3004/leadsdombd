import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";
import { getMonthlyLeadCounts } from "@/lib/lead-aggregates";
import { DashboardClient } from "./dashboard-client";

interface MonthlyData {
  month: string;
  leads: number;
  year: number;
}

interface DashboardMetrics {
  totalLeads: number;
  availableCredits: number;
  walletBalance: number;
  deliveredFiles: number;
  deliverability: number;
  monthlyTrends: MonthlyData[];
}

function getMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
}

async function getDashboardMetrics(userId: string): Promise<DashboardMetrics> {
  const t0 = performance.now();
  const tAuth = performance.now();
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const until = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const [
    user,
    totalLeads,
    deliverableUnlockedLeads,
    deliveredFiles,
    monthlyCounts,
  ] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { credits: true } }),
    db.unlockedLead.count({ where: { userId } }),
    db.unlockedLead.count({ where: { userId, agent: { isDeliverable: true } } }),
    db.leadPurchase.count({ where: { userId, status: "COMPLETED" } }),
    getMonthlyLeadCounts(userId, from, until),
  ]);
  const t1 = performance.now();
  console.log(`[LATENCY][dashboard] auth+initial-db: ${(t1 - tAuth).toFixed(2)}ms`);

  const availableCredits = user ? Number(user.credits) : 0;
  const rawDeliverability =
    totalLeads > 0
      ? Math.round((deliverableUnlockedLeads / totalLeads) * 100)
      : 100;
  const deliverability = Math.min(rawDeliverability, 99);

  const monthlyTrends = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1));
    return {
      month: getMonthLabel(date),
      leads: monthlyCounts.get(getMonthKey(date)) ?? 0,
      year: date.getUTCFullYear(),
    };
  });

  const t3 = performance.now();
  console.log(`[LATENCY][dashboard] total-db-queries: ${(t3 - t0).toFixed(2)}ms`);

  return {
    totalLeads,
    availableCredits,
    walletBalance: availableCredits,
    deliveredFiles,
    deliverability,
    monthlyTrends,
  };
}

export default async function DashboardPage() {
  const t0 = performance.now();
  const session = await auth();
  const t1 = performance.now();
  console.log(`[LATENCY][dashboard] auth-resolve: ${(t1 - t0).toFixed(2)}ms`);

  if (!session?.user?.id) {
    return null;
  }

  let metrics: DashboardMetrics = {
    totalLeads: 0,
    availableCredits: 0,
    walletBalance: 0,
    deliveredFiles: 0,
    deliverability: 99,
    monthlyTrends: [],
  };

  try {
    metrics = await getDashboardMetrics(session.user.id);
  } catch {
    // Gracefully fall back to empty state on transient data-fetch failures
  }

  const t2 = performance.now();
  console.log(`[LATENCY][dashboard] total-server-execution: ${(t2 - t0).toFixed(2)}ms`);

  const userName =
    session.user.name ??
    session.user.email?.split("@")[0] ??
    "User";

  return <DashboardClient metrics={metrics} userName={userName} />;
}
