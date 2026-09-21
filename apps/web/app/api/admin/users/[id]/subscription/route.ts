import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { overrideSubscription } from "@/lib/admin/users-service";
import type { SubscriptionTier, SubscriptionStatus } from "@fine-leads/database";

const VALID_TIERS: SubscriptionTier[] = ["FREE", "PRO", "ENTERPRISE"];
const VALID_STATUSES: SubscriptionStatus[] = [
  "ACTIVE",
  "PAST_DUE",
  "CANCELED",
  "INCOMPLETE",
  "INCOMPLETE_EXPIRED",
  "TRIALING",
  "UNPAID",
  "PAUSED",
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdminApi();
  if (adminCheck instanceof NextResponse) return adminCheck;

  const { id } = await params;

  try {
    const body = await request.json();
    const { tier, status } = body as {
      tier?: string;
      status?: string;
    };

    if (!tier || !VALID_TIERS.includes(tier as SubscriptionTier)) {
      return NextResponse.json(
        { error: `tier must be one of: ${VALID_TIERS.join(", ")}` },
        { status: 400 },
      );
    }

    if (!status || !VALID_STATUSES.includes(status as SubscriptionStatus)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 },
      );
    }

    const subscription = await overrideSubscription(
      id,
      { tier: tier as SubscriptionTier, status: status as SubscriptionStatus },
      adminCheck.user.id,
    );

    return NextResponse.json({ subscription });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to override subscription";
    console.error("[ADMIN_SUBSCRIPTION_ERROR]:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}