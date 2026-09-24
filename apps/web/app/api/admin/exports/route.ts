export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { getAdminExports, getExportStats } from "@/lib/admin/exports-service";
import type { ExportStatus } from "@fine-leads/database";

const VALID_STATUSES: ExportStatus[] = ["PROCESSING", "COMPLETED", "FAILED", "PENDING"];

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdminApi();
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || "20"), 1), 100);

    let status: ExportStatus | undefined;
    if (statusParam) {
      if (!VALID_STATUSES.includes(statusParam as ExportStatus)) {
        return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
      }
      status = statusParam as ExportStatus;
    }

    const [exportsResult, stats] = await Promise.all([
      getAdminExports({ status, page, limit }),
      getExportStats(),
    ]);

    return NextResponse.json({ ...exportsResult, stats });
  } catch (err: unknown) {
    console.error("[ADMIN_EXPORTS_API_ERROR]:", err);
    return NextResponse.json({ error: "Failed to fetch exports" }, { status: 500 });
  }
}