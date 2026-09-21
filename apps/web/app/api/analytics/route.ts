import { NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";
import { LEAD_STATES } from "@fine-leads/utils";

function getDateThreshold(timeframe: string): Date {
  const now = new Date();
  const days = timeframe === "7D" ? 7 : timeframe === "90D" ? 90 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function generateChartData(purchases: { createdAt: Date }[], timeframe: string) {
  const points = timeframe === "7D" ? 7 : timeframe === "90D" ? 90 : 30;
  const data: { label: string; value: number }[] = [];
  const threshold = getDateThreshold(timeframe);

  const purchasesInRange = purchases.filter(
    (p) => new Date(p.createdAt) >= threshold
  );

  let cumulative = 0;

  for (let i = 0; i < points; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (points - 1 - i));
    const dateKey = date.toISOString().split("T")[0];

    const dayPurchases = purchasesInRange.filter((p) => {
      const pDate = new Date(p.createdAt).toISOString().split("T")[0];
      return pDate === dateKey;
    });

    cumulative += dayPurchases.length * 200;

    const label =
      timeframe === "7D"
        ? date.toLocaleDateString("en-US", { weekday: "short" })
        : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    data.push({ label, value: cumulative });
  }

  return data;
}

function generateBarData(purchases: { createdAt: Date }[]) {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const now = new Date();
  const weekThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const weeklyPurchases = purchases.filter(
    (p) => new Date(p.createdAt) >= weekThreshold
  );

  const dayCounts = new Map<string, number>();
  for (const p of weeklyPurchases) {
    const day = dayNames[new Date(p.createdAt).getDay()];
    dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
  }

  return dayNames.slice(1).concat(dayNames.slice(0, 1)).map((day) => ({
    label: day,
    value: (dayCounts.get(day) || 0) * 200,
  }));
}

function getStateName(code: string): string {
  const state = LEAD_STATES.find((s) => s.code === code);
  return state?.name ?? code;
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const timeframe = (searchParams.get("timeframe") || "30D").slice(0, 10).trim();

    const purchases = await db.leadPurchase.findMany({
      where: { userId: session.user.id, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
    });

    const purchasedStates: string[] = Array.from(
      new Set(purchases.flatMap((p) => p.unlockedStates || []))
    );

    const allStates = LEAD_STATES.map((s) => s.code);

    const totalInventory = await db.agent.count({
      where: { isDeliverable: true },
    });

    const distinctStatesResult = await db.agent.findMany({
      select: { state: true },
      distinct: ["state"],
    });
    const totalStatesInDb = distinctStatesResult.length || LEAD_STATES.length;

    const stateGrouped = await db.agent.groupBy({
      by: ["state"],
      _count: { id: true },
      where: {
        state: { in: allStates },
        isDeliverable: true,
        email: { not: null },
      },
    });

    const countByState = new Map(
      stateGrouped.map((r) => [r.state, r._count.id])
    );

    const stateCounts = allStates.map((code) => {
      const count = countByState.get(code) ?? 0;
      const isUnlocked = purchasedStates.includes(code);
      return {
        code,
        name: getStateName(code),
        unlockedCount: isUnlocked ? count : 0,
        totalAvailable: count || 200,
        isUnlocked,
      };
    });

    const unlockedStateCodes = stateCounts
      .filter((s) => s.isUnlocked)
      .map((s) => s.code);

    const totalUnlockedLeads = unlockedStateCodes.length > 0
      ? await db.agent.count({
          where: {
            state: { in: unlockedStateCodes },
            isDeliverable: true,
            email: { not: null },
          },
        })
      : 0;

    const directPhonesCount = unlockedStateCodes.length > 0
      ? await db.agent.count({
          where: {
            state: { in: unlockedStateCodes },
            phone: { not: null },
            isDeliverable: true,
            email: { not: null },
          },
        })
      : 0;

    const nextLockedState = stateCounts.find((s) => !s.isUnlocked) || null;

    const chartData = generateChartData(purchases, timeframe);
    const barData = generateBarData(purchases);

    return NextResponse.json({
      totalUnlockedLeads,
      totalInventory,
      coverageCount: purchasedStates.length,
      totalStates: totalStatesInDb,
      directPhonesCount,
      deliverabilityScore: "100.0%",
      stateBreakdown: stateCounts,
      nextOpportunityState: nextLockedState,
      chartData,
      barData,
    });
  } catch (err: unknown) {
    console.error("[ANALYTICS_API_ERROR]:", err);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}