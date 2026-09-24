export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { getAdminAgents } from "@/lib/admin/agents-service";

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdminApi();
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? undefined;
    const state = searchParams.get("state") ?? undefined;
    const city = searchParams.get("city") ?? undefined;
    const isDeliverable = searchParams.get("isDeliverable") ?? undefined;
    const dataSource = searchParams.get("dataSource") ?? undefined;
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || "20"), 1), 100);

    const result = await getAdminAgents({
      q,
      state,
      city,
      isDeliverable,
      dataSource,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[ADMIN_AGENTS_API_ERROR]:", err);
    return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
  }
}