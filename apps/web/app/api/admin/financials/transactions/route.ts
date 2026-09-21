import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { getAdminTransactions, getFinancialKPIs } from "@/lib/admin/financials-service";
import type { WalletTransactionType } from "@fine-leads/database";

const VALID_TYPES: WalletTransactionType[] = ["RECHARGE", "CHARGE", "REFUND", "BONUS", "ADJUSTMENT"];

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdminApi();
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get("type");
    const search = searchParams.get("search") ?? undefined;
    const page = searchParams.get("page") ? Number(searchParams.get("page")) : undefined;
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;
    const includeKpis = searchParams.get("includeKpis") === "true";

    let type: WalletTransactionType | undefined;
    if (typeParam) {
      if (!VALID_TYPES.includes(typeParam as WalletTransactionType)) {
        return NextResponse.json(
          { error: `type must be one of: ${VALID_TYPES.join(", ")}` },
          { status: 400 },
        );
      }
      type = typeParam as WalletTransactionType;
    }

    const [result, kpis] = await Promise.all([
      getAdminTransactions({ type, search, page, limit }),
      includeKpis ? getFinancialKPIs() : Promise.resolve(null),
    ]);

    return NextResponse.json({ ...result, ...(kpis ? { kpis } : {}) });
  } catch (err: unknown) {
    console.error("[ADMIN_TRANSACTIONS_API_ERROR]:", err);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}