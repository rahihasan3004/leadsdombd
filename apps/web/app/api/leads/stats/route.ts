import { NextResponse } from "next/server";
import { db } from "@fine-leads/database";
import { LEAD_STATES } from "@fine-leads/utils";

const TTL_MS = 60_000;

let cachedData: Record<string, number> | null = null;
let cachedAt = 0;

export async function GET() {
  try {
    const now = Date.now();
    if (cachedData && now - cachedAt < TTL_MS) {
      return NextResponse.json(cachedData);
    }

    const stateCodes = LEAD_STATES.map((s) => s.code);

    const results = await db.agent.groupBy({
      by: ["state"],
      where: {
        AND: [
          { email: { not: null } },
          { email: { not: { equals: "" } } },
          { isDeliverable: true },
        ],
      },
      _count: { id: true },
    });

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

    cachedData = counts;
    cachedAt = now;

    return NextResponse.json(counts);
  } catch (error) {
    console.error("[LEADS_STATS_ERROR]:", error);
    return NextResponse.json({});
  }
}