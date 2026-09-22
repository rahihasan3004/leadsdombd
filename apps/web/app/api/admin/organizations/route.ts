export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { getAdminOrganizations } from "@/lib/admin/organizations-service";

export async function GET() {
  const adminCheck = await requireAdminApi();
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const organizations = await getAdminOrganizations();
    return NextResponse.json({ organizations });
  } catch (err: unknown) {
    console.error("[ADMIN_ORGANIZATIONS_API_ERROR]:", err);
    return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 });
  }
}