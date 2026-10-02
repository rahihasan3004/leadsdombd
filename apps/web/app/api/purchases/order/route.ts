import { NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";
import { generateOrderRef, generateTxnRef } from "@fine-leads/utils";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { states = [], quantity } = body;

    if (!Array.isArray(states) || states.length === 0) {
      return NextResponse.json({ error: "No states selected" }, { status: 400 });
    }

    const parsedQuantity = typeof quantity === "number" ? quantity : parseInt(String(quantity), 10);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { credits: true, id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const requiredCredits = parsedQuantity;

    if (user.credits < requiredCredits) {
      return NextResponse.json(
        {
          error: "INSUFFICIENT_CREDITS",
          required: requiredCredits,
          current: user.credits,
        },
        { status: 402 },
      );
    }

    const result = await db.$transaction(async (tx) => {
      const existingUnlocked = await tx.unlockedLead.findMany({
        where: { userId: session.user.id },
        select: { agentId: true },
      });

      const existingAgentIds = new Set(existingUnlocked.map((u) => u.agentId));

      const availableAgents = await tx.agent.findMany({
        where: {
          state: { in: states },
          isDeliverable: true,
          AND: [
            { email: { not: null } },
            { email: { not: "" } },
          ],
          id: { notIn: Array.from(existingAgentIds) },
        },
        take: requiredCredits,
        select: { id: true },
      });

      if (availableAgents.length === 0) {
        return NextResponse.json(
          { error: "No new leads available for selected states" },
          { status: 400 },
        );
      }

      const finalQuantity = availableAgents.length;
      const newCredits = user.credits - finalQuantity;

      await tx.user.update({
        where: { id: session.user.id },
        data: { credits: newCredits },
      });

      const purchase = await tx.leadPurchase.create({
        data: {
          userId: session.user.id,
          amountPaid: finalQuantity,
          leadCount: finalQuantity,
          unlockedStates: states,
          status: "COMPLETED",
          referenceId: generateOrderRef(),
        },
      });

      const walletTransaction = await tx.walletTransaction.create({
        data: {
          userId: session.user.id,
          type: "PURCHASE",
          amount: -finalQuantity,
          balanceAfter: newCredits,
          referenceId: generateTxnRef(),
          description: `Lead purchase: ${finalQuantity} leads`,
          status: "COMPLETED",
          metadata: { purchaseId: purchase.id, leadCount: finalQuantity },
        },
      });

      const unlockedLeadsData = availableAgents.map((agent) => ({
        userId: session.user.id,
        agentId: agent.id,
        purchaseId: purchase.id,
      }));

      await tx.unlockedLead.createMany({
        data: unlockedLeadsData,
      });

      return NextResponse.json({
        success: true,
        orderId: purchase.id,
        unlockedCount: finalQuantity,
        creditsDeducted: finalQuantity,
        remainingCredits: newCredits,
      });
    });

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to process lead purchase";
    console.error("[PURCHASE_ORDER_ERROR]:", err);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
