import { db } from "@fine-leads/database";
import { generateTxnRef } from "@fine-leads/utils";
import type { Prisma } from "@fine-leads/database";

export interface RefundMetadata {
  [key: string]: string;
  purchaseId: string;
  reason: string;
  timestamp: string;
}

export async function refundLeadPurchase(
  userId: string,
  purchaseId: string,
  amount: number,
  reason: string,
  tx?: Prisma.Client
) {
  if (tx) {
    return executeRefund(tx, userId, purchaseId, amount, reason);
  }

  return db.$transaction(async (innerTx) => {
    return executeRefund(innerTx, userId, purchaseId, amount, reason);
  });
}

async function executeRefund(
  client: Prisma.Client,
  userId: string,
  purchaseId: string,
  amount: number,
  reason: string
) {
  const updated = await client.leadPurchase.updateMany({
    where: { id: purchaseId, status: "COMPLETED" },
    data: { status: "REFUNDED", refundedAt: new Date() },
  });

  if (updated.count === 0) {
    throw new Error(`Purchase ${purchaseId} not found or already refunded`);
  }

  const user = await client.user.update({
    where: { id: userId },
    data: { walletBalance: { increment: amount } },
    select: { id: true, walletBalance: true },
  });

  const metadata: RefundMetadata = {
    purchaseId,
    reason,
    timestamp: new Date().toISOString(),
  };

  await client.walletTransaction.create({
    data: {
      referenceId: generateTxnRef(),
      userId,
      type: "REFUND",
      amount,
      balanceAfter: user.walletBalance,
      status: "COMPLETED",
      description: `Automatic Refund: ${reason}`,
      metadata,
    },
  });

  return { walletBalance: user.walletBalance };
}
