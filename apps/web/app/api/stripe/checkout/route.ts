import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";
import { getStripeClient } from "@/lib/stripe";
import { refundLeadPurchase } from "@/lib/refund";
import { PRICE_PER_LEAD, generateOrderRef, generateTxnRef } from "@fine-leads/utils";
import Stripe from "stripe";

const checkoutSchema = z.object({
  states: z.array(z.string().length(2, "State code must be 2 characters")).min(1, "At least one state is required"),
  requestedLeadCount: z.coerce.number().int().positive("Lead count must be a positive integer").optional(),
  paymentMethod: z.enum(["wallet", "stripe"]).default("stripe"),
});

async function getLeadCountForStates(stateCodes: string[]): Promise<number> {
  if (stateCodes.length === 0) return 0;
  return db.agent.count({
    where: {
      state: { in: stateCodes },
      email: { not: null },
      isDeliverable: true,
    },
  });
}

function shouldUseMockCheckout(): boolean {
  const key = process.env.STRIPE_SECRET_KEY || "";
  return (
    process.env.NODE_ENV !== "production" ||
    key.startsWith("sk_test_placeholder")
  );
}

const stripe = shouldUseMockCheckout()
  ? null
  : (() => {
      try {
        return getStripeClient();
      } catch {
        return null;
      }
    })();

export async function POST(req: Request) {
  try {
    const session = await auth();
    const body = await req.json().catch(() => ({}));
    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const { states, requestedLeadCount, paymentMethod } = parsed.data;

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
        { error: "User not authenticated. Please log in again." },
        { status: 401 }
      );
    }

    const minQuantity = Math.max(10, states.length);

    if (
      requestedLeadCount == null ||
      requestedLeadCount <= 0 ||
      requestedLeadCount < minQuantity
    ) {
      return NextResponse.json(
        { error: `Please select at least ${minQuantity} leads for ${states.length} selected state${states.length > 1 ? "s" : ""}.` },
        { status: 400 }
      );
    }

    const existingPurchases = await db.leadPurchase.findMany({
      where: { userId, status: "COMPLETED" },
      select: { unlockedStates: true },
    });

    const ownedStates = Array.from(
      new Set(existingPurchases.flatMap((p) => p.unlockedStates))
    );

    const newStatesToUnlock = states.filter(
      (s: string) => !ownedStates.includes(s)
    );

    if (newStatesToUnlock.length === 0) {
      return NextResponse.json(
        { error: "All selected states are already unlocked." },
        { status: 400 }
      );
    }

    const leadCount = await getLeadCountForStates(newStatesToUnlock);

    const effectiveLeadCount = requestedLeadCount != null && requestedLeadCount > 0
      ? Math.min(requestedLeadCount, leadCount)
      : leadCount;

    const totalAmount = Math.round(effectiveLeadCount * PRICE_PER_LEAD * 100) / 100;

    if (paymentMethod === "wallet") {
      const purchase = await db.$transaction(async (tx) => {
        const user = await tx.user.findUniqueOrThrow({
          where: { id: userId },
          select: { walletBalance: true },
        });

        if (user.walletBalance < totalAmount) {
          throw new Error("Insufficient wallet balance. Please add funds.");
        }

        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            walletBalance: { decrement: totalAmount },
          },
          select: { id: true, walletBalance: true },
        });

        const createdPurchase = await tx.leadPurchase.create({
          data: {
            referenceId: generateOrderRef(),
            userId,
            state: newStatesToUnlock[0] || "ALL",
            unlockedStates: newStatesToUnlock,
            amountPaid: totalAmount,
            status: "COMPLETED",
            stripeSessionId: `wallet_${Date.now()}`,
          },
        });

        await tx.walletTransaction.create({
          data: {
            referenceId: generateTxnRef(),
            userId,
            type: "CHARGE",
            amount: -totalAmount,
            balanceAfter: updatedUser.walletBalance,
            description: `Unlocked ${newStatesToUnlock.join(", ")} Real Estate Pack`,
            status: "COMPLETED",
          },
        });

        return createdPurchase;
      });

      const actualLeadCount = await getLeadCountForStates(newStatesToUnlock);

      if (actualLeadCount === 0) {
        await refundLeadPurchase(
          userId,
          purchase.id,
          totalAmount,
          "No leads available for the selected states. Purchase has been refunded."
        );

        return NextResponse.json(
          {
            error:
              "No leads available for the selected criteria. Your wallet has been automatically refunded.",
            refunded: true,
          },
          { status: 200 }
        );
      }

      return NextResponse.json({
        url: `/dashboard/lists?checkout_success=true&unlocked=${encodeURIComponent(JSON.stringify(newStatesToUnlock))}`,
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (stripe) {
      const unitAmountCents = Math.max(50, Math.round(effectiveLeadCount * PRICE_PER_LEAD * 100));

      try {
        const stripeSession = await stripe.checkout.sessions.create({
          mode: "payment",
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: `Real Estate Leads — ${effectiveLeadCount.toLocaleString()} Verified Leads (${newStatesToUnlock.length} State${newStatesToUnlock.length > 1 ? "s" : ""})`,
                  description: `${effectiveLeadCount.toLocaleString()} verified real estate agent leads across: ${newStatesToUnlock.join(", ")}`,
                },
                unit_amount: unitAmountCents,
              },
              quantity: 1,
            },
          ],
          metadata: {
            userId,
            states: newStatesToUnlock.join(","),
            leadCount: String(effectiveLeadCount),
            type: "state_pack",
          },
          success_url: `${appUrl}/dashboard/lists?checkout_success=true&stripe_session={CHECKOUT_SESSION_ID}`,
          cancel_url: `${appUrl}/dashboard/lists?checkout_cancelled=true`,
        });

        return NextResponse.json({
          url: stripeSession.url,
          stripeSessionId: stripeSession.id,
        });
      } catch (stripeErr: unknown) {
        const isAuthError =
          stripeErr instanceof Stripe.errors.StripeAuthenticationError ||
          (stripeErr instanceof Error &&
            stripeErr.message?.includes("Invalid API Key"));

        if (isAuthError) {
          console.log(
            "[MOCK_CHECKOUT] Stripe auth error, fulfilling purchase via mock:",
            { totalAmount, effectiveLeadCount, states: newStatesToUnlock }
          );
        } else {
          throw stripeErr;
        }
      }
    }

    console.log(
      "[MOCK_CHECKOUT] Fulfilling purchase:",
      { totalAmount, effectiveLeadCount, states: newStatesToUnlock }
    );

    await db.leadPurchase.create({
      data: {
        referenceId: generateOrderRef(),
        userId,
        state: newStatesToUnlock[0] || "ALL",
        unlockedStates: newStatesToUnlock,
        amountPaid: totalAmount,
        status: "COMPLETED",
        stripeSessionId: `mock_checkout_${Date.now()}`,
      },
    });

    return NextResponse.json({
      url: `/dashboard/lists?checkout_success=true&unlocked=${encodeURIComponent(JSON.stringify(newStatesToUnlock))}`,
    });
  } catch (err: unknown) {
    console.error("[INTERNAL_CHECKOUT_ERROR]:", err);
    return NextResponse.json(
      { error: "Unable to process checkout. Please try again later." },
      { status: 500 }
    );
  }
}
