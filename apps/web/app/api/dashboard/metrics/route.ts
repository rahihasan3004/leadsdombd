import { NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";
import { LEAD_STATES } from "@fine-leads/utils";

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short" });
}

const DEFAULT_MONTHLY_TRENDS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date();
  d.setMonth(d.getMonth() - (11 - i));
  d.setDate(1);
  return { month: d.toLocaleDateString("en-US", { month: "short" }) };
}).map((m) => ({ ...m, leads: 0, orders: 0 }));

const SAFE_DEFAULTS = {
  totalLeads: 0,
  walletBalance: 0,
  deliveredFiles: 0,
  deliverability: 100,
  monthlyTrends: DEFAULT_MONTHLY_TRENDS,
  recentOrders: [],
};

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { walletBalance: true },
    });

    const walletBalance = user?.walletBalance ?? 0;

    const [purchases, completedExports] = await Promise.all([
      db.leadPurchase.findMany({
        where: { userId, status: "COMPLETED" },
        orderBy: { createdAt: "asc" },
      }),
      db.leadExport.count({
        where: { userId, status: "COMPLETED" },
      }),
    ]);

    const recentPurchases = await db.leadPurchase.findMany({
      where: { userId, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    const unlockedStates = Array.from(
      new Set(purchases.flatMap((p) => p.unlockedStates || []))
    );

    const totalLeadsInVault =
      unlockedStates.length > 0
        ? await db.agent.count({
            where: {
              state: { in: unlockedStates },
              isDeliverable: true,
              email: { not: null },
            },
          })
        : 0;

    const monthlyBuckets = new Map<string, { leads: number; orders: number }>();

    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      d.setDate(1);
      monthlyBuckets.set(getMonthKey(d), { leads: 0, orders: 0 });
    }

    const monthKeys = Array.from(monthlyBuckets.keys());

    for (const purchase of purchases) {
      const key = getMonthKey(new Date(purchase.createdAt));
      if (monthlyBuckets.has(key)) {
        const stateCodes = (purchase.unlockedStates || []).map((s: string) => s.toUpperCase());
        const matching = stateCodes.filter((s: string) => LEAD_STATES.some((ls) => ls.code === s));
        const finalCodes = matching.length > 0 ? matching : stateCodes;

        const leadCount = finalCodes.length > 0
          ? await db.agent.count({
              where: {
                state: { in: finalCodes },
                isDeliverable: true,
                email: { not: null },
              },
            })
          : 0;

        const bucket = monthlyBuckets.get(key);
        if (bucket) {
          bucket.leads += leadCount;
          bucket.orders += 1;
        }
      }
    }

    const monthlyTrends = monthKeys.map((key) => {
      const [year, month] = key.split("-").map(Number);
      const d = new Date(year, month - 1, 1);
      const bucket = monthlyBuckets.get(key) ?? { leads: 0, orders: 0 };
      return {
        month: getMonthLabel(d),
        leads: bucket.leads,
        orders: bucket.orders,
      };
    });

    const recentOrders = await Promise.all(
      recentPurchases.map(async (p) => {
        const quantity =
          p.unlockedStates && p.unlockedStates.length > 0
            ? await db.agent.count({
                where: {
                  state: { in: p.unlockedStates.map((s: string) => s.toUpperCase()) },
                  isDeliverable: true,
                },
              })
            : 0;

        return {
          id: p.id,
          orderId: p.referenceId || `#LD-${p.id.slice(0, 4).toUpperCase()}`,
          date: p.createdAt.toISOString().split("T")[0],
          states: p.unlockedStates?.join(", ") || "—",
          category: "Real Estate Agents",
          quantity,
          status: "Delivered",
        };
      })
    );

    return NextResponse.json({
      totalLeads: totalLeadsInVault,
      walletBalance,
      deliveredFiles: completedExports,
      deliverability: 100,
      monthlyTrends,
      recentOrders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[DASHBOARD_METRICS_ERROR]:", message);
    return NextResponse.json(SAFE_DEFAULTS, { status: 200 });
  }
}
