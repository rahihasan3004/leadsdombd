export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { refundPurchase } from "@/lib/admin/financials-service";

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const adminCheck = await requireAdminApi();
  if (adminCheck instanceof NextResponse) return adminCheck;

  const { id } = await props.params;

  try {
    if (!adminCheck.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const adminId = adminCheck.user.id;
    const result = await refundPurchase(id, adminId);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to refund purchase";
    const status =
      message === "Purchase not found" ||
      message === "Purchase is already refunded" ||
      message === "Only completed purchases can be refunded"
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}