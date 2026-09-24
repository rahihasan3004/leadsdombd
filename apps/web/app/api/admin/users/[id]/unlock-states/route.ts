export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { grantUnlockStates } from "@/lib/admin/users-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdminApi();
  if (adminCheck instanceof NextResponse) return adminCheck;

  const { id } = await params;

  try {
    const body = await request.json();
    const { states } = body as { states?: string[] };

    if (!states || !Array.isArray(states) || states.length === 0) {
      return NextResponse.json(
        { error: "states must be a non-empty array of state codes" },
        { status: 400 },
      );
    }

    if (!adminCheck.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const purchase = await grantUnlockStates(id, states, adminCheck.user.id);

    return NextResponse.json({ purchase });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to unlock states";
    console.error("[ADMIN_UNLOCK_STATES_ERROR]:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}