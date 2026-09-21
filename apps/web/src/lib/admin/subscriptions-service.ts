import { db } from "@fine-leads/database";
import type { SubscriptionTier, SubscriptionStatus } from "@fine-leads/database";

export interface AdminSubscriptionsQuery {
  tier?: SubscriptionTier;
  status?: SubscriptionStatus;
  page?: number;
  limit?: number;
}

export async function getAdminSubscriptions(query: AdminSubscriptionsQuery) {
  const { tier, status, page = 1, limit = 20 } = query;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (tier) {
    where.tier = tier;
  }

  if (status) {
    where.status = status;
  }

  const [subscriptions, total] = await Promise.all([
    db.subscription.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        organization: {
          select: { id: true, name: true, slug: true },
        },
      },
    }),
    db.subscription.count({ where }),
  ]);

  return {
    subscriptions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getSubscriptionTierBreakdown() {
  const byTier = await db.subscription.groupBy({
    by: ["tier"],
    where: { status: "ACTIVE" },
    _count: { id: true },
  });

  const breakdown = byTier.reduce(
    (acc, s) => {
      acc[s.tier] = s._count.id;
      return acc;
    },
    {} as Record<string, number>,
  );

  return {
    ENTERPRISE: breakdown.ENTERPRISE ?? 0,
    PRO: breakdown.PRO ?? 0,
    FREE: breakdown.FREE ?? 0,
    total: (breakdown.ENTERPRISE ?? 0) + (breakdown.PRO ?? 0) + (breakdown.FREE ?? 0),
  };
}

export async function updateSubscription(
  subscriptionId: string,
  data: { tier?: SubscriptionTier; status?: SubscriptionStatus },
  adminId: string,
) {
  const existing = await db.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!existing) {
    throw new Error("Subscription not found");
  }

  const subscription = await db.subscription.update({
    where: { id: subscriptionId },
    data,
  });

  await db.auditLog.create({
    data: {
      userId: adminId,
      action: "subscription.update",
      resource: "Subscription",
      resourceId: subscriptionId,
      details: {
        previousTier: existing.tier,
        newTier: data.tier ?? existing.tier,
        previousStatus: existing.status,
        newStatus: data.status ?? existing.status,
      },
    },
  });

  return subscription;
}