export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { getAdminUsers } from "@/lib/admin/users-service";
import type { UserRole } from "@fine-leads/database";

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdminApi();
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? undefined;
    const role = searchParams.get("role") as UserRole | undefined;
    const page = searchParams.get("page") ? Number(searchParams.get("page")) : undefined;
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;

    if (role && !["USER", "ADMIN", "SUPER_ADMIN"].includes(role)) {
      return NextResponse.json({ error: "Invalid role filter" }, { status: 400 });
    }

    const result = await getAdminUsers({ search, role, page, limit });
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[ADMIN_USERS_API_ERROR]:", err);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}