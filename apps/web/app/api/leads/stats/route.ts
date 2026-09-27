import { NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";
import { LEAD_STATES } from "@fine-leads/utils";

export async function GET() {
  try {
    const session = await auth();
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

    return NextResponse.json(counts, { cache: "no-store" });
  } catch (error) {
    console.error("[LEADS_STATS_ERROR]:", error);
    return NextResponse.json({});
  }
}