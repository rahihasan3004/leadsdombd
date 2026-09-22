export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { getAdminSubscriptions, getSubscriptionTierBreakdown } from "@/lib/admin/subscriptions-service";
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

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdminApi();
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const { searchParams } = new URL(request.url);
    const tierParam = searchParams.get("tier");
    const statusParam = searchParams.get("status");
    const page = searchParams.get("page") ? Number(searchParams.get("page")) : undefined;
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;
    const includeBreakdown = searchParams.get("includeBreakdown") === "true";

    let tier: SubscriptionTier | undefined;
    if (tierParam) {
      if (!VALID_TIERS.includes(tierParam as SubscriptionTier)) {
        return NextResponse.json(
          { error: `tier must be one of: ${VALID_TIERS.join(", ")}` },
          { status: 400 },
        );
      }
      tier = tierParam as SubscriptionTier;
    }

    let status: SubscriptionStatus | undefined;
    if (statusParam) {
      if (!VALID_STATUSES.includes(statusParam as SubscriptionStatus)) {
        return NextResponse.json(
          { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
          { status: 400 },
        );
      }
      status = statusParam as SubscriptionStatus;
    }

    const [result, breakdown] = await Promise.all([
      getAdminSubscriptions({ tier, status, page, limit }),
      includeBreakdown ? getSubscriptionTierBreakdown() : Promise.resolve(null),
    ]);

    return NextResponse.json({ ...result, ...(breakdown ? { breakdown } : {}) });
  } catch (err: unknown) {
    console.error("[ADMIN_SUBSCRIPTIONS_API_ERROR]:", err);
    return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 });
  }
}