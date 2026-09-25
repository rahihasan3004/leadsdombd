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

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const dbUser = await db.user.findFirst({
      where: {
        OR: [
          { id: session.user.id },
          ...(session.user.email ? [{ email: session.user.email }] : []),
        ],
      },
      select: { walletBalance: true },
    });
    const availableBalance = Number(dbUser?.walletBalance ?? 0);

    const [purchases, completedExports] = await Promise.all([
      db.leadPurchase.findMany({
        where: { userId, status: "COMPLETED" },
        orderBy: { createdAt: "asc" },
      }),
      db.leadExport.count({
        where: { userId, status: "COMPLETED" },
      }),
    ]);

    if (purchases.length === 0) {
      return NextResponse.json({
        totalLeads: 0,
        availableBalance,
        deliveredFiles: completedExports,
        deliverability: 100,
        monthlyTrends: DEFAULT_MONTHLY_TRENDS,
        recentOrders: [],
      });
    }

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

    const allPurchaseStates = new Set<string>();
    for (const purchase of purchases) {
      const raw = purchase.unlockedStates || [];
      for (const s of raw) {
        allPurchaseStates.add(s.toUpperCase());
      }
    }

    const allPurchaseStatesArray = Array.from(allPurchaseStates);

    if (allPurchaseStatesArray.length === 0) {
      return NextResponse.json({
        totalLeads: 0,
        availableBalance,
        deliveredFiles: completedExports,
        deliverability: 100,
        monthlyTrends: DEFAULT_MONTHLY_TRENDS,
        recentOrders: [],
      });
    }

    const allStatesLeadCount =
      allPurchaseStatesArray.length > 0
        ? await db.agent.count({
            where: {
              state: { in: allPurchaseStatesArray },
              isDeliverable: true,
              email: { not: null },
            },
          })
        : 0;

    const stateLeadCountCache = new Map<string, number>();
    if (allPurchaseStatesArray.length > 0) {
      const perStateRows = await db.$queryRaw<
        { state: string; cnt: bigint }[]
      >`
        SELECT state, COUNT(*)::int AS cnt
        FROM "Agent"
        WHERE state = ANY(${allPurchaseStatesArray}::text[])
          AND isDeliverable = true
          AND email IS NOT NULL
        GROUP BY state
      `;
      for (const row of perStateRows) {
        stateLeadCountCache.set(row.state, Number(row.cnt));
      }
    }

    for (const purchase of purchases) {
      const key = getMonthKey(new Date(purchase.createdAt));
      if (monthlyBuckets.has(key)) {
        const stateCodes = (purchase.unlockedStates || []).map((s: string) => s.toUpperCase());
        const matching = stateCodes.filter((s: string) => LEAD_STATES.some((ls) => ls.code === s));
        const finalCodes = matching.length > 0 ? matching : stateCodes;

        const leadCount = finalCodes.length > 0
          ? finalCodes.reduce((sum, code) => sum + (stateLeadCountCache.get(code) || 0), 0)
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

    const recentOrders = await (async () => {
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

      return recentPurchases.map((p) => {
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
    })();

    return NextResponse.json({
      totalLeads: totalLeadsInVault,
      availableBalance,
      deliveredFiles: completedExports,
      deliverability: 100,
      monthlyTrends,
      recentOrders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[DASHBOARD_METRICS_ERROR]:", message);
    return NextResponse.json({
      totalLeads: 0,
      availableBalance: 0,
      deliveredFiles: 0,
      deliverability: 100,
      monthlyTrends: DEFAULT_MONTHLY_TRENDS,
      recentOrders: [],
    });
  }
}
