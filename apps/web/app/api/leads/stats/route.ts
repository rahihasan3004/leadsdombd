export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";
import { LEAD_STATES } from "@fine-leads/utils";
import { cachedAggregate } from "@fine-leads/utils/redis-cache";

export async function GET() {
  const t0 = performance.now();
  try {
    const session = await auth();
    const t1 = performance.now();
    console.log(`[LATENCY][api/leads/stats] auth: ${(t1 - t0).toFixed(2)}ms`);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Authenticate above even on cache hits. Only the shared inventory aggregate is cached.
    const counts = await cachedAggregate("lead-state-inventory:v1", 60, async () => {
      const results = await db.agent.groupBy({
        by: ["state"],
        where: {
          state: { not: null },
          AND: [{ email: { not: null } }, { email: { not: "" } }],
          isDeliverable: true,
        },
        _count: { id: true },
      });
      const countMap = new Map(results.map((row) => [row.state, row._count.id]));
      return Object.fromEntries(LEAD_STATES.map(({ code }) => [code, countMap.get(code) ?? 0]));
    });
    const t2 = performance.now();
    console.log(`[LATENCY][api/leads/stats] cached-inventory: ${(t2 - t1).toFixed(2)}ms`);

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