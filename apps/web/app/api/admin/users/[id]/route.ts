import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { isSuperAdmin } from "@fine-leads/auth";
import { updateUser, deleteUser, getUserDetail } from "@/lib/admin/users-service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdminApi();
  if (adminCheck instanceof NextResponse) return adminCheck;

  const { id } = await params;

  try {
    const user = await getUserDetail(id);
    return NextResponse.json({ user });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch user";
    console.error("[ADMIN_USERS_GET_ERROR]:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdminApi();
  if (adminCheck instanceof NextResponse) return adminCheck;

  const { id } = await params;

  try {
    const body = await request.json();
    const { role, organizationId, walletBalanceAdjustment, balanceReason } = body;

    if (walletBalanceAdjustment !== undefined && typeof walletBalanceAdjustment !== "number") {
      return NextResponse.json({ error: "walletBalanceAdjustment must be a number" }, { status: 400 });
    }

    const updated = await updateUser(
      id,
      { role, organizationId, walletBalanceAdjustment, balanceReason },
       adminCheck.user.id || "admin",
    );

    return NextResponse.json({ user: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update user";
    console.error("[ADMIN_USERS_PATCH_ERROR]:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdminApi();
  if (adminCheck instanceof NextResponse) return adminCheck;

  if (!isSuperAdmin((adminCheck.user as any).role)) {
    return NextResponse.json({ error: "Only SUPER_ADMIN can delete users" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const result = await deleteUser(id);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete user";
    console.error("[ADMIN_USERS_DELETE_ERROR]:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}