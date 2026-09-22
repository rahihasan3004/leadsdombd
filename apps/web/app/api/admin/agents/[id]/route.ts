export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import {
  getAdminAgentDetail,
  updateAdminAgent,
  deleteAdminAgent,
} from "@/lib/admin/agents-service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdminApi();
  if (adminCheck instanceof NextResponse) return adminCheck;

  const { id } = await params;

  try {
    const agent = await getAdminAgentDetail(id);
    return NextResponse.json({ agent });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch agent";
    console.error("[ADMIN_AGENTS_GET_ERROR]:", err);
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
    const allowedFields = [
      "fullName",
      "email",
      "phone",
      "brokerageName",
      "city",
      "state",
      "zipCode",
      "isDeliverable",
      "verificationScore",
      "licenseNumber",
    ];

    const data: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        data[field] = body[field];
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await updateAdminAgent(id, data as Parameters<typeof updateAdminAgent>[1]);
    return NextResponse.json({ agent: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update agent";
    console.error("[ADMIN_AGENTS_PATCH_ERROR]:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdminApi();
  if (adminCheck instanceof NextResponse) return adminCheck;

  const { id } = await params;

  try {
    const result = await deleteAdminAgent(id);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete agent";
    console.error("[ADMIN_AGENTS_DELETE_ERROR]:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}