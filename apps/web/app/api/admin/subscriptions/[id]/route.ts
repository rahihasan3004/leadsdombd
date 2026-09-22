import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/src/lib/admin-guard";
import { updateSubscription } from "@/src/lib/admin/subscriptions-service";
import { SubscriptionTier, SubscriptionStatus } from "@fine-leads/database";

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const adminCheck = await requireAdminApi();
  if (adminCheck instanceof NextResponse) return adminCheck;
  if (!adminCheck.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await props.params;

  try {
    const body = await req.json();
    const { tier, status } = body;

    const adminId: string = adminCheck.user.id || "admin";

    const subscription = await updateSubscription(
      id,
      {
        ...(tier ? { tier: tier as SubscriptionTier } : {}),
        ...(status ? { status: status as SubscriptionStatus } : {}),
      },
      adminId
    );

    return NextResponse.json({ subscription });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to update subscription";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
