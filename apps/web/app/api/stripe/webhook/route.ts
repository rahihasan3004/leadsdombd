import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@fine-leads/database";
import { getStripeClient } from "@/lib/stripe";

const stripe = getStripeClient();

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const relevantEvents = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

async function isEventProcessed(eventId: string): Promise<boolean> {
  const existing = await db.webhookEvent.findUnique({
    where: { eventId },
  });
  return existing !== null;
}

async function markEventProcessed(eventId: string, status: string): Promise<void> {
  await db.webhookEvent.create({
    data: {
      eventId,
      provider: "stripe",
      status,
    },
  });
}

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature") as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (!relevantEvents.has(event.type)) {
    return NextResponse.json({ received: true });
  }

  const alreadyProcessed = await isEventProcessed(event.id);
  if (alreadyProcessed) {
    return NextResponse.json({ received: true });
  }

  const status = "processed";

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }
    }

    await markEventProcessed(event.id, status);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    await markEventProcessed(event.id, "failed").catch(() => {});
    return NextResponse.json(
      { error: "Webhook handler error" },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const { userId } = session.metadata ?? {};
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!userId || !subscriptionId) return;

  const stripeSubscription = await stripe.subscriptions.retrieve(
    subscriptionId
  );

  const items = stripeSubscription.items?.data || [];
  if (items.length === 0) {
    console.warn(
      `[WEBHOOK_EMPTY_ITEMS]: Subscription ${stripeSubscription.id} has no items. Skipping tier update.`
    );
    return;
  }

  const priceId = items[0]?.price?.id;

  await db.subscription.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      stripeSubscriptionId: subscriptionId,
      stripePriceId: priceId,
      status: "ACTIVE",
      currentPeriodStart: new Date(
        stripeSubscription.current_period_start * 1000
      ),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      tier: getTierFromPriceId(priceId),
    },
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const status =
    subscription.status === "active"
      ? "ACTIVE"
      : subscription.status === "past_due"
        ? "PAST_DUE"
        : subscription.status === "canceled"
          ? "CANCELED"
          : "INCOMPLETE";

  const items = subscription.items?.data || [];
  if (items.length === 0) {
    console.warn(
      `[WEBHOOK_EMPTY_ITEMS]: Subscription ${subscription.id} has no items. Skipping tier update.`
    );
    return;
  }

  const priceId = items[0]?.price?.id;

  await db.subscription.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      stripePriceId: priceId,
      status: status as any,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
      tier: getTierFromPriceId(priceId),
    },
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  await db.subscription.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      status: "CANCELED",
      tier: "FREE",
    },
  });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  await db.subscription.updateMany({
    where: { stripeCustomerId: customerId },
    data: { status: "PAST_DUE" },
  });
}

function getTierFromPriceId(priceId?: string): "FREE" | "PRO" | "ENTERPRISE" {
  if (!priceId) return "FREE";
  const proMonthly = process.env.STRIPE_PRICE_PRO_MONTHLY;
  const proYearly = process.env.STRIPE_PRICE_PRO_YEARLY;
  const enterpriseMonthly = process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY;
  const enterpriseYearly = process.env.STRIPE_PRICE_ENTERPRISE_YEARLY;

  if (priceId === enterpriseMonthly || priceId === enterpriseYearly)
    return "ENTERPRISE";
  if (priceId === proMonthly || priceId === proYearly) return "PRO";
  return "FREE";
}
