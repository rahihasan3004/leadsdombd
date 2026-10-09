import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@fine-leads/auth";
import { db, Prisma } from "@fine-leads/database";
import { calculateLeadPrice, generateOrderRef, generateTxnRef } from "@fine-leads/utils";
import { LEAD_PURCHASE_MAX_QUANTITY, stateCodesSchema } from "@/lib/payments";

/** 1 credit = 1 lead. */
const CREDITS_PER_LEAD = 1;

const orderSchema = z.object({
  states: stateCodesSchema,
  quantity: z.coerce
    .number({ invalid_type_error: "Invalid quantity" })
    .int("Invalid quantity")
    .min(1, "Invalid quantity")
    .max(LEAD_PURCHASE_MAX_QUANTITY, `Maximum ${LEAD_PURCHASE_MAX_QUANTITY.toLocaleString()} leads per order`),
});

/** Thrown inside the transaction to abort (and roll back) with a specific HTTP response. */
class OrderError extends Error {
  constructor(
    readonly status: number,
    readonly body: { error: string } & Record<string, unknown>,
  ) {
    super(body.error);
  }
}

interface OrderResult {
  orderId: string;
  unlockedCount: number;
  creditsDeducted: number;
  remainingCredits: number;
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = orderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid order" },
      { status: 400 },
    );
  }
  const { states, quantity } = parsed.data;
  const requestedCredits = quantity * CREDITS_PER_LEAD;

  try {
    // Fast, non-authoritative pre-check for a friendly error before scanning inventory.
    const current = await db.user.findUnique({ where: { id: userId }, select: { credits: true } });
    if (!current) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (current.credits < requestedCredits) {
      return NextResponse.json(
        { error: "INSUFFICIENT_CREDITS", required: requestedCredits, current: current.credits },
        { status: 402 },
      );
    }

    const result = await db.$transaction(
      async (tx): Promise<OrderResult> => {
        const agents = await tx.agent.findMany({
          where: {
            state: { in: states },
            isDeliverable: true,
            AND: [{ email: { not: null } }, { email: { not: "" } }],
            unlockedBy: { none: { userId } },
          },
          take: quantity,
          select: { id: true },
        });

        if (agents.length === 0) {
          throw new OrderError(400, { error: "No new leads available for selected states" });
        }

        const leadCount = agents.length;
        const creditsToDeduct = leadCount * CREDITS_PER_LEAD;

        // Atomic conditional debit: the balance check and decrement happen in one
        // UPDATE, so concurrent orders can never take the balance below zero.
        const debit = await tx.user.updateMany({
          where: { id: userId, credits: { gte: creditsToDeduct } },
          data: { credits: { decrement: creditsToDeduct } },
        });
        if (debit.count === 0) {
          const latest = await tx.user.findUnique({ where: { id: userId }, select: { credits: true } });
          throw new OrderError(402, {
            error: "INSUFFICIENT_CREDITS",
            required: creditsToDeduct,
            current: latest?.credits ?? 0,
          });
        }

        const { credits: remainingCredits } = await tx.user.findUniqueOrThrow({
          where: { id: userId },
          select: { credits: true },
        });

        const purchase = await tx.leadPurchase.create({
          data: {
            userId,
            // amountPaid is a USD amount everywhere (revenue KPIs, refunds, UI), so store
            // the monetary value of the credits spent at the standard per-lead rate.
            amountPaid: new Prisma.Decimal(calculateLeadPrice(leadCount)),
            leadCount,
            unlockedStates: states,
            status: "COMPLETED",
            referenceId: generateOrderRef(),
          },
        });

        await tx.walletTransaction.create({
          data: {
            userId,
            type: "PURCHASE",
            amount: -creditsToDeduct,
            balanceAfter: remainingCredits,
            referenceId: generateTxnRef(),
            description: `Lead purchase: ${leadCount} leads`,
            status: "COMPLETED",
            metadata: { purchaseId: purchase.id, leadCount, creditsSpent: creditsToDeduct },
          },
        });

        // Unique (userId, agentId): if a concurrent order unlocked the same lead, this
        // throws P2002 and the whole transaction (including the debit) rolls back.
        await tx.unlockedLead.createMany({
          data: agents.map((agent) => ({ userId, agentId: agent.id, purchaseId: purchase.id })),
        });

        return {
          orderId: purchase.id,
          unlockedCount: leadCount,
          creditsDeducted: creditsToDeduct,
          remainingCredits,
        };
      },
      { maxWait: 10_000, timeout: 30_000 },
    );

    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    if (err instanceof OrderError) {
      return NextResponse.json(err.body, { status: err.status });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "Another order is in progress for these leads. Please try again." },
        { status: 409 },
      );
    }
    console.error("[PURCHASE_ORDER_ERROR]:", err);
    return NextResponse.json({ error: "Failed to process lead purchase" }, { status: 500 });
  }
}
