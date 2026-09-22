export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { importAgents } from "@/lib/admin/agents-service";

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdminApi();
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const body = await request.json();

    if (!body.rows || !Array.isArray(body.rows)) {
      return NextResponse.json({ error: "Missing or invalid 'rows' array" }, { status: 400 });
    }

    if (body.rows.length === 0) {
      return NextResponse.json({ error: "No rows to import" }, { status: 400 });
    }

    if (body.rows.length > 5000) {
      return NextResponse.json({ error: "Maximum 5000 rows per import" }, { status: 400 });
    }

    const result = await importAgents(body.rows);
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[ADMIN_AGENTS_IMPORT_ERROR]:", err);
    return NextResponse.json({ error: "Failed to import agents" }, { status: 500 });
  }
}