import { NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";

function purchaseIdOf(metadata: unknown): string | null {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const value = (metadata as Record<string, unknown>).purchaseId;
    return typeof value === "string" ? value : null;
  }
  return null;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const transactions = await db.walletTransaction.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Lead-purchase debits carry metadata.purchaseId; resolve it to the order's
    // LD-ORD-... reference so Billing rows match the Leads Vault.
    const purchaseIds = Array.from(
      new Set(transactions.map((tx) => purchaseIdOf(tx.metadata)).filter((id): id is string => Boolean(id)))
    );
    const orders = purchaseIds.length
      ? await db.leadPurchase.findMany({
          where: { id: { in: purchaseIds }, userId: session.user.id },
          select: { id: true, referenceId: true },
        })
      : [];
    const orderRefById = new Map(orders.map((o) => [o.id, o.referenceId]));

    const serializedTransactions = transactions.map((tx) => {
      const purchaseId = purchaseIdOf(tx.metadata);
      const orderRef = purchaseId ? orderRefById.get(purchaseId) ?? null : null;
      const displayRef =
        orderRef ??
        (tx.referenceId?.startsWith("LD-") ? tx.referenceId : `LD-TXN-${tx.id.slice(-8).toUpperCase()}`);
      return {
        ...tx,
        amount: tx.amount ? Number(tx.amount.toString()) : 0,
        purchaseId,
        orderRef,
        displayRef,
      };
    });
    return NextResponse.json({ transactions: serializedTransactions || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[TRANSACTIONS_ERROR]:", message);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}
