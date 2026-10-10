export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import {
  updateUser,
  AdminUserMutationError,
  deleteUser,
  getUserDetail,
} from "@/lib/admin/users-service";
import type { AdminUser } from "@/lib/admin-guard";
import type { UserRole } from "@fine-leads/database";

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
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body))
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    if ("role" in body) {
      if ((adminCheck.user as AdminUser).role !== "SUPER_ADMIN")
        return NextResponse.json(
          { error: "Only SUPER_ADMIN can change roles" },
          { status: 403 },
        );
      if (id === adminCheck.user.id)
        return NextResponse.json(
          { error: "You cannot change your own role" },
          { status: 403 },
        );
      if (!["USER", "ADMIN", "SUPER_ADMIN"].includes(body.role))
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    const ALLOWED_FIELDS = [
      "role",
      "organizationId",
      "walletBalanceAdjustment",
      "balanceReason",
    ] as const;
    const updateFields: Record<string, unknown> = {};

    for (const field of ALLOWED_FIELDS) {
      if (field in body) {
        updateFields[field] = body[field];
      }
    }

    const { role, organizationId, walletBalanceAdjustment, balanceReason } =
      updateFields as {
        role?: UserRole;
        organizationId?: string;
        walletBalanceAdjustment?: number;
        balanceReason?: string;
      };

    if (
      walletBalanceAdjustment !== undefined &&
      typeof walletBalanceAdjustment !== "number"
    ) {
      return NextResponse.json(
        { error: "walletBalanceAdjustment must be a number" },
        { status: 400 },
      );
    }

    const updated = await updateUser(
      id,
      { role, organizationId, walletBalanceAdjustment, balanceReason },
      (adminCheck.user as AdminUser).id,
      adminCheck.session.user.tokenVersion,
    );

    return NextResponse.json({ user: updated });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to update user";
    if (err instanceof AdminUserMutationError)
      return NextResponse.json({ error: err.message }, { status: err.status });
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

  const userRole = (adminCheck.user as AdminUser).role;
  if (userRole !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Only SUPER_ADMIN can delete users" },
      { status: 403 },
    );
  }

  const { id } = await params;

  try {
    const result = await deleteUser(id);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to delete user";
    console.error("[ADMIN_USERS_DELETE_ERROR]:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
