import { db } from "@fine-leads/database";

function getStartOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function getStartOfLastMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 1);
}

function getEndOfLastMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 0);
}

export async function getAdminAnalytics() {
  const startOfMonth = getStartOfMonth();
  const startOfLastMonth = getStartOfLastMonth();
  const endOfLastMonth = getEndOfLastMonth();

  const [
    totalUsers,
    newUsersThisMonth,
    newUsersLastMonth,
    usersByRole,
    activeSubscriptions,
    activeSubscriptionsLastMonth,
    subscriptionsByTier,
    totalAgents,
    verifiedAgents,
    deliverableAgents,
    walletBalanceAgg,
    totalPurchases,
    purchasesRevenue,
    recentAuditLogs,
    recentTransactions,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    db.user.count({
      where: {
        createdAt: { gte: startOfLastMonth, lt: startOfMonth },
      },
    }),
    db.user.groupBy({ by: ["role"], _count: { id: true } }),
    db.subscription.count({ where: { status: "ACTIVE" } }),
    db.subscription.count({
      where: {
        status: "ACTIVE",
        createdAt: { gte: startOfLastMonth, lt: startOfMonth },
      },
    }),
    db.subscription.groupBy({
      by: ["tier"],
      where: { status: "ACTIVE" },
      _count: { id: true },
    }),
    db.agent.count(),
    db.agent.count({ where: { isVerified: true } }),
    db.agent.count({ where: { isDeliverable: true, email: { not: null } } }),
    db.user.aggregate({ _sum: { walletBalance: true } }),
    db.leadPurchase.count(),
    db.leadPurchase.aggregate({ _sum: { amountPaid: true } }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.walletTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  const auditLogUserIds = [
    ...new Set(recentAuditLogs.map((log) => log.userId).filter((id): id is string => id !== null)),
  ];

  const auditLogUsers =
    auditLogUserIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: auditLogUserIds } },
          select: { id: true, name: true, email: true },
        })
      : [];

  const userMap = new Map(auditLogUsers.map((u) => [u.id, u]));

  const auditLogsWithUsers = recentAuditLogs.map((log) => ({
    id: log.id,
    action: log.action,
    resource: log.resource,
    resourceId: log.resourceId,
    ipAddress: log.ipAddress,
    createdAt: log.createdAt,
    user: log.userId ? userMap.get(log.userId) ?? null : null,
  }));

  const roleBreakdown = usersByRole.reduce(
    (acc, r) => {
      acc[r.role] = r._count.id;
      return acc;
    },
    {} as Record<string, number>
  );

  const tierBreakdown = subscriptionsByTier.reduce(
    (acc, s) => {
      acc[s.tier] = s._count.id;
      return acc;
    },
    {} as Record<string, number>
  );

  const newUsersTrend =
    newUsersLastMonth > 0
      ? Math.round(((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100)
      : newUsersThisMonth > 0
        ? 100
        : 0;

  const activeSubscriptionsTrend =
    activeSubscriptionsLastMonth > 0
      ? Math.round(
          ((activeSubscriptions - activeSubscriptionsLastMonth) / activeSubscriptionsLastMonth) * 100
        )
      : activeSubscriptions > 0
        ? 100
        : 0;

  return {
    users: {
      total: totalUsers,
      newThisMonth: newUsersThisMonth,
      trend: newUsersTrend,
      byRole: {
        USER: roleBreakdown.USER ?? 0,
        ADMIN: roleBreakdown.ADMIN ?? 0,
        SUPER_ADMIN: roleBreakdown.SUPER_ADMIN ?? 0,
      },
    },
    subscriptions: {
      active: activeSubscriptions,
      trend: activeSubscriptionsTrend,
      byTier: {
        FREE: tierBreakdown.FREE ?? 0,
        PRO: tierBreakdown.PRO ?? 0,
        ENTERPRISE: tierBreakdown.ENTERPRISE ?? 0,
      },
    },
    agents: {
      total: totalAgents,
      verified: verifiedAgents,
      deliverable: deliverableAgents,
      unverified: totalAgents - verifiedAgents,
    },
    financials: {
      totalWalletBalance: walletBalanceAgg._sum.walletBalance ?? 0,
      totalPurchases,
      totalRevenue: purchasesRevenue._sum.amountPaid ?? 0,
    },
    recentActivity: {
      auditLogs: auditLogsWithUsers,
      transactions: recentTransactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        status: tx.status,
        description: tx.description,
        createdAt: tx.createdAt,
        user: tx.user,
      })),
    },
  };
}

export type AdminAnalytics = Awaited<ReturnType<typeof getAdminAnalytics>>;