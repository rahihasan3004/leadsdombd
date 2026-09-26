export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";

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
    const availableBalance = user ? Number(user.walletBalance) : 0;

    const [
      purchases,
      deliverableUnlockedLeads,
      totalLeads,
      deliveredFiles,
    ] = await Promise.all([
      db.leadPurchase.findMany({
        where: { userId, status: "COMPLETED" },
        orderBy: { createdAt: "asc" },
      }),
      db.unlockedLead.count({
        where: {
          userId,
          agent: { isDeliverable: true },
        },
      }),
      db.unlockedLead.count({ where: { userId } }),
      db.leadPurchase.count({ where: { userId, status: "COMPLETED" } }),
    ]);

    const deliverability =
      totalLeads > 0
        ? Math.round((deliverableUnlockedLeads / totalLeads) * 100)
        : 100;

    const monthlyBuckets = new Map<string, { leads: number; orders: number }>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      d.setDate(1);
      monthlyBuckets.set(getMonthKey(d), { leads: 0, orders: 0 });
    }

    for (const purchase of purchases) {
      const key = getMonthKey(new Date(purchase.createdAt));
      if (monthlyBuckets.has(key)) {
        monthlyBuckets.get(key)!.orders += 1;
      }
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
      const bucket = monthlyBuckets.get(key) ?? { leads: 0, orders: 0 };
      return {
        month: getMonthLabel(d),
        leads: bucket.leads,
        orders: bucket.orders,
      };
    });

    const recentPurchases = await db.leadPurchase.findMany({
      where: { userId, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    const recentStateSet = new Set<string>();
    for (const p of recentPurchases) {
      const raw = p.unlockedStates || [];
      for (const s of raw) {
        recentStateSet.add(s.toUpperCase());
      }
    }
    const recentStatesArr = Array.from(recentStateSet);
    const recentStateCache = new Map<string, number>();

    if (recentStatesArr.length > 0) {
      const rows = await db.$queryRaw<{ state: string; cnt: bigint }[]>`
        SELECT state, COUNT(*)::int AS cnt
        FROM "Agent"
        WHERE state = ANY(${recentStatesArr}::text[])
          AND isDeliverable = true
          AND email IS NOT NULL
        GROUP BY state
      `;
      for (const row of rows) {
        recentStateCache.set(row.state, Number(row.cnt));
      }
    }

    const recentOrders = recentPurchases.map((p) => {
      const codes = (p.unlockedStates || []).map((s: string) => s.toUpperCase());
      const quantity =
        codes.length > 0
          ? codes.reduce((sum, code) => sum + (recentStateCache.get(code) || 0), 0)
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
    });

    return NextResponse.json({
      totalLeads,
      availableBalance,
      walletBalance: availableBalance,
      deliveredFiles,
      deliverability,
      monthlyTrends,
      recentOrders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[DASHBOARD_METRICS_ERROR]:", message);
    return NextResponse.json({
      totalLeads: 0,
      availableBalance: 0,
      walletBalance: 0,
      deliveredFiles: 0,
      deliverability: 100,
      monthlyTrends: DEFAULT_MONTHLY_TRENDS,
      recentOrders: [],
    });
  }
}
