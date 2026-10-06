import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";
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
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short" });
}

async function getDashboardMetrics(userId: string): Promise<DashboardMetrics> {
  const t0 = performance.now();
  const tAuth = performance.now();
  const [
    user,
    totalLeads,
    deliverableUnlockedLeads,
    deliveredFiles,
    purchases,
  ] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { credits: true } }),
    db.unlockedLead.count({ where: { userId } }),
    db.unlockedLead.count({ where: { userId, agent: { isDeliverable: true } } }),
    db.leadPurchase.count({ where: { userId, status: "COMPLETED" } }),
    db.leadPurchase.findMany({
      where: { userId, status: "COMPLETED" },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const t1 = performance.now();
  console.log(`[LATENCY][dashboard] auth+initial-db: ${(t1 - tAuth).toFixed(2)}ms`);

  const availableCredits = user ? Number(user.credits) : 0;
  const deliverability =
    totalLeads > 0
      ? Math.round((deliverableUnlockedLeads / totalLeads) * 100)
      : 100;

  const monthlyBuckets = new Map<string, { leads: number }>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    d.setDate(1);
    monthlyBuckets.set(getMonthKey(d), { leads: 0 });
  }

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const unlockedLeads = await db.unlockedLead.findMany({
    where: {
      userId,
      createdAt: { gte: twelveMonthsAgo },
    },
    select: { createdAt: true },
  });
  const t2 = performance.now();
  console.log(`[LATENCY][dashboard] monthly-unlockedLead-fetch: ${(t2 - t1).toFixed(2)}ms`);

  const hasUnlockedLeads = unlockedLeads.length > 0;

  for (const ul of unlockedLeads) {
    const key = getMonthKey(new Date(ul.createdAt));
    if (monthlyBuckets.has(key)) {
      monthlyBuckets.get(key)!.leads += 1;
    }
  }

  if (!hasUnlockedLeads) {
    for (const purchase of purchases) {
      const key = getMonthKey(new Date(purchase.createdAt));
      if (monthlyBuckets.has(key)) {
        monthlyBuckets.get(key)!.leads += purchase.leadCount;
      }
    }
  }

  const monthKeys = Array.from(monthlyBuckets.keys());
  const monthlyTrends = monthKeys.map((key) => {
    const [year, month] = key.split("-").map(Number);
    const d = new Date(year, month - 1, 1);
    const bucket = monthlyBuckets.get(key) ?? { leads: 0 };
    return {
      month: getMonthLabel(d),
      leads: bucket.leads,
      year,
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
    deliverability: 100,
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
