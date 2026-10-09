import { db } from "@fine-leads/database";
import { generateTxnRef } from "@fine-leads/utils";
import type { Prisma, WalletTransactionType } from "@fine-leads/database";
import type { PurchaseStatus } from "@fine-leads/database";
import crypto from "crypto";

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
  return db.$transaction(async (tx) => {
    const purchase = await tx.leadPurchase.findUnique({ where: { id: purchaseId } });

    if (!purchase) {
      throw new Error("Purchase not found");
    }
    if (purchase.status === "REFUNDED") {
      throw new Error("Purchase is already refunded");
    }
    if (purchase.status !== "COMPLETED") {
      throw new Error("Only completed purchases can be refunded");
    }

    const updated = await tx.leadPurchase.updateMany({
      where: { id: purchaseId, status: "COMPLETED" },
      data: { status: "REFUNDED", refundedAt: new Date() },
    });
    if (updated.count === 0) {
      throw new Error("Purchase is already refunded or ineligible");
    }

    // Credit-funded orders have a PURCHASE ledger entry linked via metadata.purchaseId
    // (see /api/purchases/order). Card-paid (Lemon Squeezy) and admin-granted purchases don't.
    const debit = await tx.walletTransaction.findFirst({
      where: {
        userId: purchase.userId,
        type: "PURCHASE",
        metadata: { path: ["purchaseId"], equals: purchase.id },
      },
      select: { amount: true },
    });
    const creditsToReturn = debit ? Math.abs(Math.trunc(Number(debit.amount))) : 0;
    const refundMethod: "CREDITS" | "EXTERNAL" = creditsToReturn > 0 ? "CREDITS" : "EXTERNAL";

    // Revoke the individual leads unlocked by this order.
    const revoked = await tx.unlockedLead.deleteMany({ where: { purchaseId } });

    let walletTransaction: { id: string; referenceId: string } | null = null;
    let newCredits: number | null = null;

    if (creditsToReturn > 0) {
      const user = await tx.user.update({
        where: { id: purchase.userId },
        data: { credits: { increment: creditsToReturn } },
        select: { credits: true },
      });
      newCredits = user.credits;

      walletTransaction = await tx.walletTransaction.create({
        data: {
          referenceId: generateRefundRef(),
          userId: purchase.userId,
          type: "REFUND",
          amount: creditsToReturn,
          balanceAfter: user.credits,
          description: `Refund for purchase ${purchase.referenceId}: ${creditsToReturn} credits returned`,
          status: "COMPLETED",
          metadata: {
            purchaseId: purchase.id,
            purchaseRef: purchase.referenceId,
            refundedStates: purchase.unlockedStates,
            refundedBy: adminId,
            creditsReturned: creditsToReturn,
            revokedLeads: revoked.count,
          },
        },
        select: { id: true, referenceId: true },
      });
    }

    const remainingCoverage = await tx.leadPurchase.findMany({
      where: { userId: purchase.userId, status: "COMPLETED", id: { not: purchaseId } },
      select: { unlockedStates: true },
    });
    const stillCoveredStates = new Set(remainingCoverage.flatMap((p) => p.unlockedStates));
    const fullyRevokedStates = purchase.unlockedStates.filter((s) => !stillCoveredStates.has(s));

    await tx.auditLog.create({
      data: {
        userId: adminId,
        action: "purchase.refund",
        resource: "LeadPurchase",
        resourceId: purchaseId,
        details: {
          purchaseRef: purchase.referenceId,
          userId: purchase.userId,
          amountPaid: purchase.amountPaid.toString(),
          refundMethod,
          creditsReturned: creditsToReturn,
          revokedLeads: revoked.count,
          states: purchase.unlockedStates,
          fullyRevokedStates,
          txnRef: walletTransaction?.referenceId ?? null,
          ...(refundMethod === "EXTERNAL"
            ? { note: "No credits were spent on this purchase; refund any card payment in Lemon Squeezy." }
            : {}),
        },
      },
    });

    return {
      purchaseId: purchase.id,
      purchaseRef: purchase.referenceId,
      refundMethod,
      creditsReturned: creditsToReturn,
      revokedLeads: revoked.count,
      newCredits,
      walletTransaction,
    };
  });
}
