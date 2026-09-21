import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { getAdminPurchases, getFinancialKPIs } from "@/lib/admin/financials-service";
import type { PurchaseStatus } from "@fine-leads/database";

const VALID_STATUSES: PurchaseStatus[] = ["COMPLETED", "REFUNDED", "PENDING"];

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdminApi();
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const state = searchParams.get("state") ?? undefined;
    const page = searchParams.get("page") ? Number(searchParams.get("page")) : undefined;
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;
    const includeKpis = searchParams.get("includeKpis") === "true";

    let status: PurchaseStatus | undefined;
    if (statusParam) {
      if (!VALID_STATUSES.includes(statusParam as PurchaseStatus)) {
        return NextResponse.json(
          { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
          { status: 400 },
        );
      }
      status = statusParam as PurchaseStatus;
    }

    const [result, kpis] = await Promise.all([
      getAdminPurchases({ status, state, page, limit }),
      includeKpis ? getFinancialKPIs() : Promise.resolve(null),
    ]);

    return NextResponse.json({ ...result, ...(kpis ? { kpis } : {}) });
  } catch (err: unknown) {
    console.error("[ADMIN_PURCHASES_API_ERROR]:", err);
    return NextResponse.json({ error: "Failed to fetch purchases" }, { status: 500 });
  }
}