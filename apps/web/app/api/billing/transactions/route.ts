import { NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";

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

    return NextResponse.json({ transactions: transactions || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[TRANSACTIONS_ERROR]:", message);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}
