import { db } from "@fine-leads/database";
import { generateTxnRef } from "@fine-leads/utils";
import type { Prisma, WalletTransactionType } from "@fine-leads/database";
import type { PurchaseStatus } from "@fine-leads/database";

const REFUND_REF_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRefundRef(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  let id = "";
  for (let i = 0; i < 4; i++) {
    id += REFUND_REF_CHARSET[bytes[i] % REFUND_REF_CHARSET.length];
  }
  return `LD-TXN-REF-${id}`;
}

export interface AdminTransactionsQuery {
  type?: WalletTransactionType;
  search?: string;
  page?: number;
  limit?: number;
}

export async function getAdminTransactions(query: AdminTransactionsQuery) {
  const { type, search, page = 1, limit = 20 } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.WalletTransactionWhereInput = {};

  if (type) {
    where.type = type;
  }

  if (search) {
    where.OR = [
      { referenceId: { contains: search, mode: "insensitive" } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [transactions, total] = await Promise.all([
    db.walletTransaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    db.walletTransaction.count({ where }),
  ]);

  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export interface AdminPurchasesQuery {
  status?: PurchaseStatus;
  state?: string;
  page?: number;
  limit?: number;
}

export async function getAdminPurchases(query: AdminPurchasesQuery) {
  const { status, state, page = 1, limit = 20 } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.LeadPurchaseWhereInput = {};

  if (status) {
    where.status = status;
  }

  if (state) {
    where.unlockedStates = { has: state.toUpperCase() };
  }

  const [purchases, total] = await Promise.all([
    db.leadPurchase.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    db.leadPurchase.count({ where }),
  ]);

  return {
    purchases,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getFinancialKPIs() {
  const [revenueAgg, walletAgg, refundedAgg] = await Promise.all([
    db.leadPurchase.aggregate({
      _sum: { amountPaid: true },
      where: { status: "COMPLETED" },
    }),
    db.user.aggregate({
      _sum: { walletBalance: true },
    }),
    db.leadPurchase.aggregate({
      _sum: { amountPaid: true },
      where: { status: "REFUNDED" },
    }),
  ]);

  return {
    totalRevenue: revenueAgg._sum.amountPaid ?? 0,
    totalWalletBalance: walletAgg._sum.walletBalance ?? 0,
    totalRefunded: refundedAgg._sum.amountPaid ?? 0,
  };
}

export async function refundPurchase(purchaseId: string, adminId: string) {
  const purchase = await db.leadPurchase.findUnique({
    where: { id: purchaseId },
    include: {
      user: { select: { id: true } },
    },
  });

  if (!purchase) {
    throw new Error("Purchase not found");
  }

  if (purchase.status === "REFUNDED") {
    throw new Error("Purchase is already refunded");
  }

  if (purchase.status !== "COMPLETED") {
    throw new Error("Only completed purchases can be refunded");
  }

  const result = await db.$transaction(async (tx) => {
    await tx.leadPurchase.update({
      where: { id: purchaseId },
      data: { status: "REFUNDED" },
    });

    const user = await tx.user.update({
      where: { id: purchase.userId },
      data: { walletBalance: { increment: purchase.amountPaid } },
      select: { id: true, walletBalance: true },
    });

    const walletTransaction = await tx.walletTransaction.create({
      data: {
        referenceId: generateRefundRef(),
        userId: purchase.userId,
        type: "REFUND",
        amount: purchase.amountPaid,
        balanceAfter: user.walletBalance,
        description: `Refund for purchase ${purchase.referenceId}`,
        status: "COMPLETED",
        metadata: {
          purchaseId: purchase.id,
          purchaseRef: purchase.referenceId,
          refundedStates: purchase.unlockedStates,
          refundedBy: adminId,
        },
      },
    });

    const remainingCoverage = await tx.leadPurchase.findMany({
      where: {
        userId: purchase.userId,
        status: "COMPLETED",
        id: { not: purchaseId },
      },
      select: { unlockedStates: true },
    });

    const stillCoveredStates = new Set(
      remainingCoverage.flatMap((p) => p.unlockedStates)
    );
    const fullyRevokedStates = purchase.unlockedStates.filter(
      (s) => !stillCoveredStates.has(s)
    );

    if (fullyRevokedStates.length > 0) {
      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: "purchase.refund",
          resource: "LeadPurchase",
          resourceId: purchaseId,
          details: {
            purchaseRef: purchase.referenceId,
            userId: purchase.userId,
            amount: purchase.amountPaid,
            states: purchase.unlockedStates,
            fullyRevokedStates,
            txnRef: walletTransaction.referenceId,
          },
        },
      });
    } else {
      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: "purchase.refund",
          resource: "LeadPurchase",
          resourceId: purchaseId,
          details: {
            purchaseRef: purchase.referenceId,
            userId: purchase.userId,
            amount: purchase.amountPaid,
            states: purchase.unlockedStates,
            note: "All refunded states are still covered by other active purchases",
            txnRef: walletTransaction.referenceId,
          },
        },
      });
    }

    return {
      purchase,
      walletTransaction,
      newWalletBalance: user.walletBalance,
    };
  });

  return result;
}