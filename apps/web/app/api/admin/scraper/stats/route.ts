import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { getScraperStats, getScraperDailyTrend } from "@/lib/admin/scraper-service";

export async function GET() {
  const adminCheck = await requireAdminApi();
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const [stats, dailyTrend] = await Promise.all([
      getScraperStats(),
      getScraperDailyTrend(),
    ]);

    return NextResponse.json({ ...stats, dailyTrend });
  } catch (err: unknown) {
    console.error("[ADMIN_SCRAPER_STATS_API_ERROR]:", err);
    return NextResponse.json(
      { error: "Failed to fetch scraper stats" },
      { status: 500 }
    );
  }
}