import { db } from "@fine-leads/database";
import { generateTxnRef } from "@fine-leads/utils";

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
  reason: string
) {
  return db.$transaction(async (tx) => {
    const purchase = await tx.leadPurchase.findFirst({
      where: { id: purchaseId, status: { not: "REFUNDED" } },
      select: { id: true },
    });

    if (!purchase) {
      throw new Error(`Purchase ${purchaseId} not found or already refunded`);
    }

    await tx.leadPurchase.update({
      where: { id: purchaseId },
      data: { status: "REFUNDED" },
    });

    const user = await tx.user.update({
      where: { id: userId },
      data: { walletBalance: { increment: amount } },
      select: { id: true, walletBalance: true },
    });

    const metadata: RefundMetadata = {
      purchaseId,
      reason,
      timestamp: new Date().toISOString(),
    };

    await tx.walletTransaction.create({
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
  });
}