import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@fine-leads/database";
import { getStripeClient } from "@/lib/stripe";
import { refundLeadPurchase } from "@/lib/refund";
import { generateOrderRef, generateTxnRef } from "@fine-leads/utils";

const stripe = getStripeClient();

const webhookSecret =
  process.env.STRIPE_PURCHASE_WEBHOOK_SECRET ||
  process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature") as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("Purchase webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  try {
    const checkoutSession = event.data.object as Stripe.Checkout.Session;

    if (checkoutSession.mode !== "payment") {
      return NextResponse.json({ received: true });
    }

    const existingPurchase = await db.leadPurchase.findFirst({
      where: { stripeSessionId: checkoutSession.id },
    });

    if (existingPurchase) {
      console.log(
        `[WEBHOOK_DUPLICATE_IGNORED]: Session ${checkoutSession.id} already fulfilled.`
      );
      return NextResponse.json({
        received: true,
        message: "Already processed",
      });
    }

    const {
      userId,
      type,
      states: statesRaw,
      amount: metadataAmount,
    } = checkoutSession.metadata ?? {};

    if (!userId) {
      console.error("Missing userId in purchase webhook metadata");
      return NextResponse.json({ received: true });
    }

    if (type === "wallet_topup") {
      const topupAmount = Number(metadataAmount);
      if (!topupAmount || isNaN(topupAmount) || topupAmount <= 0) {
        console.error("Invalid wallet top-up amount in webhook");
        return NextResponse.json({ received: true });
      }

      const existingTx = await db.walletTransaction.findFirst({
        where: { stripeSessionId: checkoutSession.id },
      });

      if (existingTx) {
        console.log(
          `[WEBHOOK_DUPLICATE_WALLET_IGNORED]: Wallet top-up session ${checkoutSession.id} already processed.`
        );
        return NextResponse.json({
          received: true,
          message: "Already processed",
        });
      }

      await db.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id: userId },
          data: { walletBalance: { increment: topupAmount } },
          select: { id: true, walletBalance: true },
        });

        await tx.walletTransaction.create({
          data: {
            referenceId: generateTxnRef(),
            userId,
            type: "RECHARGE",
            amount: topupAmount,
            balanceAfter: user.walletBalance,
            description: `Wallet Top-Up via Stripe (+$${topupAmount.toFixed(2)})`,
            stripeSessionId: checkoutSession.id,
status: "COMPLETED",
          },
        });
      });

      console.log(
        `Wallet top-up for user ${userId}: $${topupAmount.toFixed(2)}`
      );
      return NextResponse.json({ received: true });
    }

    if (!statesRaw) {
      console.error("Missing states in purchase webhook metadata");
      return NextResponse.json({ received: true });
    }

    const stateCodes = statesRaw.split(",").filter(Boolean);
    const rawCents = checkoutSession.amount_total || 0;
    const amountPaid = Number((rawCents / 100).toFixed(2));

    const existingPurchases = await db.leadPurchase.findMany({
      where: { userId, status: "COMPLETED" },
    });

    const existingStates = new Set(
      existingPurchases.flatMap((p) => p.unlockedStates)
    );

    const newStateCodes = stateCodes.filter(
      (code) => !existingStates.has(code)
    );

    if (newStateCodes.length > 0) {
      const purchase = await db.$transaction(async (tx) => {
        return tx.leadPurchase.create({
          data: {
            referenceId: generateOrderRef(),
            userId,
            unlockedStates: newStateCodes,
            amountPaid,
            stripeSessionId: checkoutSession.id,
            status: "COMPLETED",
          },
        });
      });

      console.log(
        `Created lead purchase record for user ${userId} with ${newStateCodes.length} states`
      );

      const actualLeadCount = await db.agent.count({
        where: {
          state: { in: newStateCodes },
          email: { not: null },
          isDeliverable: true,
        },
      });

      if (actualLeadCount === 0) {
        await refundLeadPurchase(
          userId,
          purchase.id,
          amountPaid,
          "No leads available for the purchased states. Purchase has been refunded to your wallet."
        );

        console.log(
          `[WEBHOOK_REFUND] Refunded purchase ${purchase.id} for user ${userId} — 0 leads in states: ${newStateCodes.join(", ")}`
        );
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Purchase webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler error" },
      { status: 500 }
    );
  }
}