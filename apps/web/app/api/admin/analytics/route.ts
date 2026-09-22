export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { getAdminAnalytics } from "@/lib/admin/analytics-service";

export async function GET() {
  const adminCheck = await requireAdminApi();
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const analytics = await getAdminAnalytics();
    return NextResponse.json(analytics);
  } catch (err: unknown) {
    console.error("[ADMIN_ANALYTICS_API_ERROR]:", err);
    return NextResponse.json(
      { error: "Failed to fetch admin analytics" },
      { status: 500 }
    );
  }
}