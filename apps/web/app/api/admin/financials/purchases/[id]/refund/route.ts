import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { refundPurchase } from "@/lib/admin/financials-service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdminApi();
  if (adminCheck instanceof NextResponse) return adminCheck;

  const { id } = await params;

  try {
    const result = await refundPurchase(id, adminCheck.user.id);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to refund purchase";
    console.error("[ADMIN_PURCHASE_REFUND_ERROR]:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}