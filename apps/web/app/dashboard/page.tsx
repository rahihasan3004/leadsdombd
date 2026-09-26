import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";
import { DashboardClient } from "./dashboard-client";

interface MonthlyData {
  month: string;
  leads: number;
}

interface DashboardMetrics {
  totalLeads: number;
  availableBalance: number;
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
  const [
    user,
    totalLeads,
    deliverableUnlockedLeads,
    deliveredFiles,
    purchases,
  ] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { walletBalance: true } }),
    db.unlockedLead.count({ where: { userId } }),
    db.unlockedLead.count({ where: { userId, agent: { isDeliverable: true } } }),
    db.leadPurchase.count({ where: { userId, status: "COMPLETED" } }),
    db.leadPurchase.findMany({
      where: { userId, status: "COMPLETED" },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const availableBalance = user ? Number(user.walletBalance) : 0;
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

  if (unlockedLeads.length > 0) {
    for (const ul of unlockedLeads) {
      const key = getMonthKey(new Date(ul.createdAt));
      if (monthlyBuckets.has(key)) {
        monthlyBuckets.get(key)!.leads += 1;
      }
    }
  } else if (purchases.length > 0) {
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
    };
  });

  return {
    totalLeads,
    availableBalance,
    walletBalance: availableBalance,
    deliveredFiles,
    deliverability,
    monthlyTrends,
  };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const metrics = await getDashboardMetrics(session.user.id);

  const userName =
    session.user.name ??
    session.user.email?.split("@")[0] ??
    "User";

  return <DashboardClient metrics={metrics} userName={userName} />;
}
