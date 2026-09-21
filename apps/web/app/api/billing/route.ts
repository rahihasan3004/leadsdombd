import { NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";

export async function GET() {
  try {
    const session = await auth();

    let userId = session?.user?.id;

    if (!userId && session?.user?.email) {
      const dbUser = await db.user.findUnique({
        where: { email: session.user.email },
      });
      if (dbUser) {
        userId = dbUser.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { walletBalance: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User account not found." }, { status: 404 });
    }

    const walletTransactions = await db.walletTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        referenceId: true,
        type: true,
        amount: true,
        description: true,
        status: true,
        createdAt: true,
        stripeSessionId: true,
      },
      take: 50,
    });

    const leadPurchases = await db.leadPurchase.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        referenceId: true,
        amountPaid: true,
        status: true,
        createdAt: true,
        unlockedStates: true,
        stripeSessionId: true,
      },
      take: 50,
    });

    const purchaseTransactions = leadPurchases.map((p) => ({
      id: p.id,
      referenceId: p.referenceId,
      type: "CHARGE",
      amount: p.amountPaid,
      description:
        p.unlockedStates.length > 0
          ? `${p.unlockedStates.join(", ")} Pack (${p.unlockedStates.length} State${p.unlockedStates.length > 1 ? "s" : ""})`
          : "State Pack Purchase",
      status: p.status,
      createdAt: p.createdAt,
      stripeSessionId: p.stripeSessionId,
    }));

    const allTransactions = [...walletTransactions, ...purchaseTransactions]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 50);

    return NextResponse.json({
      walletBalance: user.walletBalance ?? 0,
      transactions: allTransactions,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[BILLING_API_ERROR]:", message);
    return NextResponse.json(
      { error: "Internal server error", walletBalance: 0, transactions: [] },
      { status: 500 }
    );
  }
}