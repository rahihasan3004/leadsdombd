import { Prisma } from "@fine-leads/database";
import {
  calculateLeadPrice,
  generateOrderRef,
  generateTxnRef,
  getLeadCreditCost,
  type LeadTier,
} from "@fine-leads/utils";
import {
  createParallelPlan,
  parallelFulfillmentEnabled,
} from "./scraper/parallel-dispatcher";
import {
  freshInventoryWhere,
  fulfillmentConfigured,
  planFulfillmentRuns,
  FULFILLMENT_CATEGORY,
  FULFILLMENT_TTL_MS,
} from "./scraper/fulfillment-policy";
import { enqueueOrderEmail } from "./email/order-emails";
export class OrderError extends Error {
  constructor(
    readonly status: number,
    readonly body: { error: string } & Record<string, unknown>,
  ) {
    super(body.error);
  }
}
export interface OrderResult {
  orderId: string;
  unlockedCount: number;
  creditsDeducted: number;
  remainingCredits: number;
  tier: LeadTier;
  status: "COMPLETED" | "PROCESSING";
}
/** Same inventory, tier checks, exact allocation, and durable shortage jobs for both payment sources. */
export async function createQuantityLeadPurchase(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    states: string[];
    quantity: number;
    tier: LeadTier;
    category?: string;
    funding:
      | { kind: "credits" }
      | { kind: "card"; amountCents: number; referenceId: string };
  },
): Promise<OrderResult> {
  const { userId, states, quantity, tier, funding } = input;
  const category = input.category ?? FULFILLMENT_CATEGORY;
  const requestedCredits = getLeadCreditCost(quantity, tier);
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
  let parallelPlan: ReturnType<typeof createParallelPlan> | null = null;
  if (processing && quantity >= 500 && parallelFulfillmentEnabled()) {
    try {
      parallelPlan = createParallelPlan(
        states,
        quantity,
        tier,
        requestedCredits,
      );
    } catch {
      throw new OrderError(503, {
        error:
          "Parallel fulfillment capacity is not configured for this order. No credits were deducted.",
      });
    }
  }
  const status = processing ? "PROCESSING" : "COMPLETED";
  const leadCount = quantity;
  const creditsToDeduct = funding.kind === "credits" ? requestedCredits : 0;

  let remainingCredits = 0;
  if (funding.kind === "credits") {
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

    const balance = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { credits: true },
    });
    remainingCredits = balance.credits;
  }
  const purchase = await tx.leadPurchase.create({
    data: {
      userId,
      tier,
      // amountPaid is a USD amount everywhere (revenue KPIs, refunds, UI), so store
      // the monetary value of the credits spent at the standard per-credit rate.
      amountPaid:
        funding.kind === "card"
          ? new Prisma.Decimal(funding.amountCents).div(100)
          : new Prisma.Decimal(calculateLeadPrice(creditsToDeduct)),
      leadCount,
      unlockedStates: states,
      status,
      referenceId:
        funding.kind === "card" ? funding.referenceId : generateOrderRef(),
    },
  });

  if (funding.kind === "credits") {
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
  }

  // Unique (userId, agentId): if a concurrent order unlocked the same lead, this
  // throws P2002 and the whole transaction (including the debit) rolls back.
  if (processing) {
    // Durable background dispatch: never fire-and-forget a chargeable API call in a request.
    await tx.leadFulfillmentJob.create({
      data: {
        purchaseId: purchase.id,
        category,
        creditsHeld: creditsToDeduct,
        parallelConfig: parallelPlan?.config ?? undefined,
        expiresAt: new Date(Date.now() + FULFILLMENT_TTL_MS),
        runs: {
          create: parallelPlan?.runs ?? planFulfillmentRuns(states, quantity),
        },
      },
    });
    await enqueueOrderEmail(tx, purchase.id, "PROCESSING");
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
}
