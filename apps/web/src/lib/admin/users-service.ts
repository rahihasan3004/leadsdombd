import { db } from "@fine-leads/database";
import { generateTxnRef } from "@fine-leads/utils";
import type { Prisma, UserRole } from "@fine-leads/database";
import type { SubscriptionTier, SubscriptionStatus } from "@fine-leads/database";

const ADMIN_REF_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateAdminRef(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += ADMIN_REF_CHARSET[bytes[i] % ADMIN_REF_CHARSET.length];
  }
  return `LD-ORD-ADMIN-${id}`;
}

export interface AdminUsersQuery {
  search?: string;
  role?: UserRole;
  page?: number;
  limit?: number;
}

export async function getAdminUsers(query: AdminUsersQuery) {
  const { search, role, page = 1, limit = 20 } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  if (role) {
    where.role = role;
  }

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        walletBalance: true,
        createdAt: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        subscriptions: {
          where: { status: "ACTIVE" },
          select: { tier: true },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: { purchases: true },
        },
      },
    }),
    db.user.count({ where }),
  ]);

  const mapped = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    walletBalance: user.walletBalance,
    createdAt: user.createdAt,
    organization: user.organization,
    subscriptionTier: user.subscriptions[0]?.tier ?? null,
    leadPurchasesCount: user._count.purchases,
  }));

  return {
    users: mapped,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function updateUser(
  userId: string,
  data: {
    role?: UserRole;
    organizationId?: string;
    walletBalanceAdjustment?: number;
    balanceReason?: string;
  },
  adminId: string,
) {
  const { role, organizationId, walletBalanceAdjustment, balanceReason } = data;

  if (walletBalanceAdjustment !== undefined) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { walletBalance: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const newBalance = user.walletBalance + walletBalanceAdjustment;
    const isAddition = walletBalanceAdjustment > 0;

    const [, updatedUser] = await db.$transaction([
      db.walletTransaction.create({
        data: {
          referenceId: generateTxnRef(),
          userId,
          type: isAddition ? "BONUS" : "REFUND",
          amount: Math.abs(walletBalanceAdjustment),
          balanceAfter: newBalance,
          description: balanceReason ?? `Admin balance adjustment by ${adminId}`,
          status: "COMPLETED",
          metadata: { adjustedBy: adminId, previousBalance: user.walletBalance },
        },
      }),
      db.user.update({
        where: { id: userId },
        data: { walletBalance: newBalance },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          walletBalance: true,
          organization: { select: { id: true, name: true } },
        },
      }),
    ]);

    return updatedUser;
  }

  const updateData: Prisma.UserUpdateInput = {};
  if (role) updateData.role = role;
  if (organizationId) updateData.organization = { connect: { id: organizationId } };

  return db.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      walletBalance: true,
      organization: { select: { id: true, name: true } },
    },
  });
}

export async function deleteUser(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new Error("User not found");
  }

  await db.user.delete({ where: { id: userId } });
  return { deleted: true, userId };
}

export async function getUserDetail(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      role: true,
      walletBalance: true,
      createdAt: true,
      organization: {
        select: { id: true, name: true, slug: true },
      },
      subscriptions: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      purchases: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      walletTransactions: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const unlockedStatesSet = new Set<string>();
  for (const purchase of user.purchases) {
    if (purchase.status === "COMPLETED" && purchase.unlockedStates) {
      for (const state of purchase.unlockedStates) {
        unlockedStatesSet.add(state);
      }
    }
  }
  const unlockedStates = Array.from(unlockedStatesSet).sort();

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.image,
    role: user.role,
    walletBalance: user.walletBalance,
    createdAt: user.createdAt,
    organization: user.organization,
    subscription: user.subscriptions[0] ?? null,
    unlockedStates,
    recentPurchases: user.purchases,
    recentTransactions: user.walletTransactions,
  };
}

export async function grantUnlockStates(
  userId: string,
  stateCodes: string[],
  adminId: string,
) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const referenceId = generateAdminRef();

  const [purchase] = await db.$transaction([
    db.leadPurchase.create({
      data: {
        referenceId,
        userId,
        state: null,
        unlockedStates: stateCodes,
        amountPaid: 0,
        status: "COMPLETED",
      },
    }),
    db.auditLog.create({
      data: {
        userId: adminId,
        action: "user.unlock_states",
        resource: "User",
        resourceId: userId,
        details: { states: stateCodes, referenceId },
      },
    }),
  ]);

  return purchase;
}

export async function revokeUnlockStates(
  userId: string,
  stateCodes: string[],
  adminId: string,
) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const purchases = await db.leadPurchase.findMany({
    where: {
      userId,
      status: "COMPLETED",
      unlockedStates: { hasSome: stateCodes },
    },
  });

  for (const purchase of purchases) {
    const updatedStates = purchase.unlockedStates.filter(
      (s) => !stateCodes.includes(s),
    );
    await db.leadPurchase.update({
      where: { id: purchase.id },
      data: { unlockedStates: updatedStates },
    });
  }

  await db.auditLog.create({
    data: {
      userId: adminId,
      action: "user.revoke_states",
      resource: "User",
      resourceId: userId,
      details: { states: stateCodes },
    },
  });

  return { revoked: stateCodes };
}

export async function overrideSubscription(
  userId: string,
  data: { tier: SubscriptionTier; status: SubscriptionStatus },
  adminId: string,
) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, organizationId: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const existing = await db.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  let subscription;
  if (existing) {
    subscription = await db.subscription.update({
      where: { id: existing.id },
      data: { tier: data.tier, status: data.status },
    });
  } else {
    subscription = await db.subscription.create({
      data: {
        userId,
        organizationId: user.organizationId ?? "",
        tier: data.tier,
        status: data.status,
      },
    });
  }

  await db.auditLog.create({
    data: {
      userId: adminId,
      action: "user.subscription_override",
      resource: "Subscription",
      resourceId: subscription.id,
      details: { previousTier: existing?.tier, newTier: data.tier, newStatus: data.status },
    },
  });

  return subscription;
}