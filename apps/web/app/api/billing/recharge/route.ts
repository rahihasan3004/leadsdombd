import { NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";
import { generateTxnRef } from "@fine-leads/utils";
import Stripe from "stripe";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-03-31.basil" as any,
    })
  : null;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const rawAmount = Number(body.amount);

    if (!rawAmount || isNaN(rawAmount) || !Number.isFinite(rawAmount)) {
      return NextResponse.json(
        { error: "Invalid recharge amount." },
        { status: 400 }
      );
    }

    if (rawAmount < 10) {
      return NextResponse.json(
        { error: "Minimum recharge is $10.00." },
        { status: 400 }
      );
    }

    if (rawAmount > 5000) {
      return NextResponse.json(
        { error: "Maximum single recharge is $5,000.00." },
        { status: 400 }
      );
    }

    if (stripe) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

      const stripeSession = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "LeadsDom Wallet Top-Up",
                description: `Add $${rawAmount.toFixed(2)} to your wallet`,
              },
              unit_amount: Math.round(rawAmount * 100),
            },
            quantity: 1,
          },
        ],
        metadata: {
          userId: session.user.id,
          type: "wallet_topup",
          amount: String(rawAmount),
        },
        success_url: `${appUrl}/dashboard/billing?topup_success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/dashboard/billing?topup_cancelled=true`,
      });

      return NextResponse.json({
        url: stripeSession.url,
        stripeSessionId: stripeSession.id,
      });
    }

    if (process.env.NODE_ENV === "development") {
      console.log(
        "[DEV_MOCK] Stripe keys missing, crediting wallet directly:",
        rawAmount
      );

      const updatedUser = await db.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id: session.user.id },
          data: { walletBalance: { increment: rawAmount } },
          select: { id: true, walletBalance: true },
        });

        await tx.walletTransaction.create({
          data: {
            referenceId: generateTxnRef(),
            userId: session.user.id,
            type: "RECHARGE",
            amount: rawAmount,
            balanceAfter: user.walletBalance,
            description: `Wallet Top-Up (+$${rawAmount.toFixed(2)})`,
            status: "COMPLETED",
          },
        });

        return user;
      });

      return NextResponse.json({
        success: true,
        amount: rawAmount,
        newBalance: updatedUser.walletBalance,
        devMode: true,
      });
    }

    return NextResponse.json(
      { error: "Payment processing is currently unavailable." },
      { status: 500 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[RECHARGE_ERROR]:", message);
    return NextResponse.json(
      { error: "Recharge failed. Please try again." },
      { status: 500 }
    );
  }
}