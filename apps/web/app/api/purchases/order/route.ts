import { NextResponse, after } from "next/server";
import { processNextFulfillment } from "@/lib/scraper/order-fulfillment";

export const maxDuration = 120;
import { z } from "zod";
import { auth } from "@fine-leads/auth";
import { db, Prisma } from "@fine-leads/database";
import {
  calculateLeadPrice,
  generateOrderRef,
  generateTxnRef,
  getLeadCreditCost,
  type LeadTier,
} from "@fine-leads/utils";
import { LEAD_PURCHASE_MAX_QUANTITY, stateCodesSchema } from "@/lib/payments";

import {
  freshInventoryWhere,
  fulfillmentConfigured,
  planFulfillmentRuns,
  FULFILLMENT_CATEGORY,
  FULFILLMENT_TTL_MS,
} from "@/lib/scraper/fulfillment-policy";

const orderSchema = z.object({
  states: stateCodesSchema,
  category: z.literal(FULFILLMENT_CATEGORY).default(FULFILLMENT_CATEGORY),
  tier: z.enum(["PHONE_ONLY", "VERIFIED_EMAIL"]).default("VERIFIED_EMAIL"),
  quantity: z.coerce
    .number({ invalid_type_error: "Invalid quantity" })
    .int("Invalid quantity")
    .min(1, "Invalid quantity")
    .max(
      LEAD_PURCHASE_MAX_QUANTITY,
      `Maximum ${LEAD_PURCHASE_MAX_QUANTITY.toLocaleString()} leads per order`,
    ),
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
  tier: LeadTier;
  status: "COMPLETED" | "PROCESSING";
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
  const { states, quantity, tier, category } = parsed.data;
  const requestedCredits = getLeadCreditCost(quantity, tier);

  try {
    // Fast, non-authoritative pre-check for a friendly error before scanning inventory.
    const current = await db.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    });
    if (!current) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (current.credits < requestedCredits) {
      return NextResponse.json(
        {
          error: "INSUFFICIENT_CREDITS",
          required: requestedCredits,
          current: current.credits,
        },
        { status: 402 },
      );
    }

    const result = await db.$transaction(
      async (tx): Promise<OrderResult> => {
        const agents = await tx.agent.findMany({
          where: freshInventoryWhere(userId, states, tier),
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          take: quantity,
          select: { id: true },
        });

        const processing = agents.length < quantity;
        if (processing && !fulfillmentConfigured()) {
          throw new OrderError(503, {
            error:
              "On-demand fulfillment is not configured. No credits were deducted.",
          });
        }
        const status = processing ? "PROCESSING" : "COMPLETED";
        const leadCount = quantity;
        const creditsToDeduct = requestedCredits;

        // Atomic conditional debit: the balance check and decrement happen in one
        // UPDATE, so concurrent orders can never take the balance below zero.
        const debit = await tx.user.updateMany({
          where: { id: userId, credits: { gte: creditsToDeduct } },
          data: { credits: { decrement: creditsToDeduct } },
        });
        if (debit.count === 0) {
          const latest = await tx.user.findUnique({
            where: { id: userId },
            select: { credits: true },
          });
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
            tier,
            // amountPaid is a USD amount everywhere (revenue KPIs, refunds, UI), so store
            // the monetary value of the credits spent at the standard per-credit rate.
            amountPaid: new Prisma.Decimal(calculateLeadPrice(creditsToDeduct)),
            leadCount,
            unlockedStates: states,
            status,
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
            description: `${processing ? "Lead order credit hold" : "Lead purchase"}: ${leadCount} leads (${tier})`,
            status: "COMPLETED",
            metadata: {
              purchaseId: purchase.id,
              leadCount,
              tier,
              creditsPerLead: getLeadCreditCost(1, tier),
              creditsSpent: creditsToDeduct,
              fulfillmentStatus: status,
            },
          },
        });

        // Unique (userId, agentId): if a concurrent order unlocked the same lead, this
        // throws P2002 and the whole transaction (including the debit) rolls back.
        if (processing) {
          // Durable background dispatch: never fire-and-forget a chargeable API call in a request.
          await tx.leadFulfillmentJob.create({
            data: {
              purchaseId: purchase.id,
              category,
              creditsHeld: creditsToDeduct,
              expiresAt: new Date(Date.now() + FULFILLMENT_TTL_MS),
              runs: { create: planFulfillmentRuns(states, quantity) },
            },
          });
        } else {
          await tx.unlockedLead.createMany({
            data: agents.map((agent) => ({
              userId,
              agentId: agent.id,
              purchaseId: purchase.id,
            })),
          });
        }

        return {
          orderId: purchase.id,
          tier,
          status,
          unlockedCount: processing ? 0 : leadCount,
          creditsDeducted: creditsToDeduct,
          remainingCredits,
        };
      },
      { maxWait: 10_000, timeout: 30_000 },
    );

    if (result.status === "PROCESSING") {
      // Next's lifecycle-aware after() starts dispatch AFTER the response, not a detached promise.
      // A recurring consumer still guarantees recovery, subsequent polling and verification.
      try {
        after(async () => {
          try {
            await processNextFulfillment({ purchaseId: result.orderId });
          } catch {
            console.error(
              "[LOBSTR_DISPATCH_DEFERRED]: Durable job retained for the worker",
            );
          }
        });
      } catch {
        // Never report an accepted/charged order as failed if background registration is unavailable.
        console.error(
          "[LOBSTR_BACKGROUND_UNAVAILABLE]: Durable job retained for the worker",
        );
      }
    }
    return NextResponse.json(
      { success: true, ...result },
      { status: result.status === "PROCESSING" ? 202 : 200 },
    );
  } catch (err: unknown) {
    if (err instanceof OrderError) {
      return NextResponse.json(err.body, { status: err.status });
    }
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error:
            "Another order is in progress for these leads. Please try again.",
        },
        { status: 409 },
      );
    }
    console.error("[PURCHASE_ORDER_ERROR]:", err);
    return NextResponse.json(
      { error: "Failed to process lead purchase" },
      { status: 500 },
    );
  }
}
