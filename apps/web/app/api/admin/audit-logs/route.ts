export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { getAdminAuditLogs } from "@/lib/admin/audit-logs-service";

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdminApi();
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") ?? undefined;
    const resource = searchParams.get("resource") ?? undefined;
    const search = searchParams.get("search") ?? undefined;
    const page = searchParams.get("page") ? Number(searchParams.get("page")) : undefined;
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;

    const result = await getAdminAuditLogs({ action, resource, search, page, limit });
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[ADMIN_AUDIT_LOGS_API_ERROR]:", err);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}