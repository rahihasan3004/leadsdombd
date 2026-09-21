import { NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";
import { getStripeClient } from "@/lib/stripe";
import { generateTxnRef } from "@fine-leads/utils";

const stripe = process.env.STRIPE_SECRET_KEY ? getStripeClient() : null;

export async function POST(req: Request) {
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
        { error: "User not authenticated" },
        { status: 401 }
      );
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
                name: "Wallet Top-Up",
                description: `Add $${rawAmount.toFixed(2)} to your LeadsDom wallet`,
              },
              unit_amount: Math.round(rawAmount * 100),
            },
            quantity: 1,
          },
        ],
        metadata: {
          userId,
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
          where: { id: userId },
          data: { walletBalance: { increment: rawAmount } },
          select: { id: true, walletBalance: true },
        });

        await tx.walletTransaction.create({
          data: {
            referenceId: generateTxnRef(),
            userId,
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
    console.error("[INTERNAL_WALLET_CHECKOUT_ERROR]:", err);
    return NextResponse.json(
      { error: "Unable to process wallet checkout. Please try again later." },
      { status: 500 }
    );
  }
}