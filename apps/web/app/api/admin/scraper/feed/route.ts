export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { getScraperFeed } from "@/lib/admin/scraper-service";

export async function GET() {
  const adminCheck = await requireAdminApi();
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const feed = await getScraperFeed();
    return NextResponse.json(feed);
  } catch (err: unknown) {
    console.error("[ADMIN_SCRAPER_FEED_API_ERROR]:", err);
    return NextResponse.json(
      { error: "Failed to fetch scraper feed" },
      { status: 500 }
    );
  }
}