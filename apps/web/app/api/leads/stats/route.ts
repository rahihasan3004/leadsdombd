export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";
import { LEAD_STATES } from "@fine-leads/utils";

export async function GET() {
  const t0 = performance.now();
  try {
    const session = await auth();
    const t1 = performance.now();
    console.log(`[LATENCY][api/leads/stats] auth: ${(t1 - t0).toFixed(2)}ms`);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stateCodes = LEAD_STATES.map((s) => s.code);

    const results = await db.agent.groupBy({
      by: ["state"],
      where: {
        state: { not: null },
        AND: [
          { email: { not: null } },
          { email: { not: "" } },
        ],
        isDeliverable: true,
      },
      _count: { id: true },
    });
    const t2 = performance.now();
    console.log(`[LATENCY][api/leads/stats] db-agent-groupBy: ${(t2 - t1).toFixed(2)}ms`);

    const countMap: Record<string, number> = {};
    for (const row of results) {
      if (row.state) {
        countMap[row.state] = row._count.id;
      }
    }

    const counts: Record<string, number> = {};
    for (const code of stateCodes) {
      counts[code] = countMap[code] ?? 0;
    }

    const t3 = performance.now();
    console.log(`[LATENCY][api/leads/stats] total: ${(t3 - t0).toFixed(2)}ms`);

    return NextResponse.json(counts, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[LEADS_STATS_ERROR]:", error);
    return NextResponse.json({});
  }
}