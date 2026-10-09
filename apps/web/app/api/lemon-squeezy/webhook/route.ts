import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { db, Prisma } from "@fine-leads/database";
import { getLemonSqueezyStoreId, getLemonSqueezyWebhookSecret } from "@/lib/lemon-squeezy";
import { verifyCheckoutCustomData, type PricedOrder } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/* Payload schema (only the fields we rely on)                         */
/* ------------------------------------------------------------------ */

const cents = z.coerce.number().int().nonnegative();

const orderAttributesSchema = z.object({
  store_id: z.coerce.string().optional(),
  user_email: z.string().optional(),
  currency: z.string().default("USD"),
  status: z.string(),
  refunded: z.boolean().optional(),
  subtotal: cents,
  discount_total: cents.default(0),
  total: cents,
  subtotal_usd: cents.optional(),
  discount_total_usd: cents.optional(),
  refunded_amount: cents.default(0),
  updated_at: z.string().optional(),
});

const webhookSchema = z.object({
  meta: z.object({
    event_name: z.string(),
    custom_data: z.record(z.unknown()).optional(),
  }),
  data: z.object({
    id: z.coerce.string().min(1),
    type: z.string(),
    attributes: z.record(z.unknown()),
  }),
});

type OrderAttributes = z.infer<typeof orderAttributesSchema>;
type Tx = Prisma.TransactionClient;
type Outcome = { status: "processed" | "ignored" | "rejected"; detail: string };

class RetryableWebhookError extends Error {}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function isValidSignature(rawBody: string, signature: string, secret: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest();
  return crypto.timingSafeEqual(Buffer.from(signature, "hex"), expected);
}

/** Net amount actually charged before tax, in USD cents. */
function netPaidUsdCents(a: OrderAttributes): number {
  if (a.currency.toUpperCase() === "USD") return a.subtotal - a.discount_total;
  return (a.subtotal_usd ?? 0) - (a.discount_total_usd ?? 0);
}

/**
 * Lemon Squeezy does not send a per-delivery id, so the idempotency key is
 * derived from the resource id plus the state that makes the event unique.
 */
function idempotencyKey(eventName: string, orderId: string, a: OrderAttributes | null): string {
  if (eventName === "order_created") return `ls:order_created:${orderId}`;
  if (eventName === "order_refunded") return `ls:order_refunded:${orderId}:${a?.refunded_amount ?? 0}`;
  return `ls:${eventName}:${orderId}:${a?.updated_at ?? "na"}`;
}

const topupRef = (orderId: string) => `ls_order_${orderId}`;
const leadPurchaseRef = (orderId: string) => `lp_${orderId}`;

/* ------------------------------------------------------------------ */
/* Event handlers                                                      */
/* ------------------------------------------------------------------ */

async function handleOrderCreated(
  tx: Tx,
  orderId: string,
  attrs: OrderAttributes,
  customData: unknown
): Promise<Outcome> {
  if (attrs.status !== "paid") {
    return { status: "ignored", detail: `order status ${attrs.status}` };
  }

  const verified = verifyCheckoutCustomData(customData);
  if (!verified) {
    return { status: "rejected", detail: "custom data missing, unknown or signature mismatch" };
  }
  const { userId, order } = verified;

  const paid = netPaidUsdCents(attrs);
  if (paid < order.amountCents) {
    return { status: "rejected", detail: `underpaid: paid ${paid}c, expected ${order.amountCents}c` };
  }

  const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new RetryableWebhookError(`user ${userId} not found`);

  await fulfillOrder(tx, user.id, orderId, order);
  return { status: "processed", detail: `${order.type} fulfilled` };
}

async function fulfillOrder(tx: Tx, userId: string, orderId: string, order: PricedOrder) {
  const amountPaid = new Prisma.Decimal(order.amountCents).div(100);

  if (order.type === "LEAD_PURCHASE") {
    await tx.leadPurchase.create({
      data: {
        userId,
        unlockedStates: order.states,
        leadCount: order.quantity,
        amountPaid,
        status: "COMPLETED",
        referenceId: leadPurchaseRef(orderId),
      },
    });
    return;
  }

  const updated = await tx.user.update({
    where: { id: userId },
    data: { credits: { increment: order.credits } },
    select: { credits: true },
  });

  await tx.walletTransaction.create({
    data: {
      userId,
      amount: order.credits,
      type: "RECHARGE",
      status: "COMPLETED",
      balanceAfter: updated.credits,
      description: `Wallet top-up via Lemon Squeezy (Order #${orderId})`,
      referenceId: topupRef(orderId),
      metadata: { lsOrderId: orderId, tierId: order.tierId, amountCents: order.amountCents },
    },
  });
}

async function handleOrderRefunded(tx: Tx, orderId: string, attrs: OrderAttributes): Promise<Outcome> {
  const isFull = attrs.status === "refunded" || attrs.refunded === true || attrs.refunded_amount >= attrs.total;
  const fraction = isFull || attrs.total === 0 ? 1 : Math.min(1, attrs.refunded_amount / attrs.total);

  // Lead purchase paid by card: revoke access only on full refund.
  const purchase = await tx.leadPurchase.findUnique({
    where: { referenceId: leadPurchaseRef(orderId) },
    select: { id: true, status: true },
  });
  if (purchase) {
    if (!isFull) return { status: "processed", detail: "partial refund on lead purchase; access kept" };
    await tx.leadPurchase.updateMany({
      where: { id: purchase.id, status: "COMPLETED" },
      data: { status: "REFUNDED", refundedAt: new Date() },
    });
    return { status: "processed", detail: "lead purchase revoked" };
  }

  // Wallet top-up (new deterministic ref, or legacy `ls_order_<id>_<ts>`).
  const topup = await tx.walletTransaction.findFirst({
    where: {
      type: "RECHARGE",
      OR: [{ referenceId: topupRef(orderId) }, { referenceId: { startsWith: `${topupRef(orderId)}_` } }],
    },
    select: { id: true, userId: true, amount: true },
  });
  if (!topup) return { status: "ignored", detail: "no matching order found" };

  const purchasedCredits = Math.trunc(Number(topup.amount));
  const targetRevoked = isFull ? purchasedCredits : Math.floor(purchasedCredits * fraction);

  const prior = await tx.walletTransaction.aggregate({
    where: { type: "ADJUSTMENT", metadata: { path: ["lsOrderId"], equals: orderId } },
    _sum: { amount: true },
  });
  const alreadyRevoked = Math.abs(Number(prior._sum.amount ?? 0));
  const toRevoke = Math.max(0, targetRevoked - alreadyRevoked);

  if (toRevoke > 0) {
    // Balance may go negative if credits were already spent; purchases are blocked until it is repaid.
    const updated = await tx.user.update({
      where: { id: topup.userId },
      data: { credits: { decrement: toRevoke } },
      select: { credits: true },
    });
    await tx.walletTransaction.create({
      data: {
        userId: topup.userId,
        amount: -toRevoke,
        type: "ADJUSTMENT",
        status: "COMPLETED",
        balanceAfter: updated.credits,
        description: `Credits reversed: Lemon Squeezy refund (Order #${orderId})`,
        referenceId: `ls_refund_${orderId}_${attrs.refunded_amount}`,
        metadata: { lsOrderId: orderId, refundedAmountCents: attrs.refunded_amount, full: isFull },
      },
    });
  }

  if (isFull) {
    await tx.walletTransaction.update({ where: { id: topup.id }, data: { status: "REFUNDED" } });
  }

  return { status: "processed", detail: `revoked ${toRevoke} credits` };
}

/* ------------------------------------------------------------------ */
/* Route                                                               */
/* ------------------------------------------------------------------ */

async function recordEvent(eventId: string, status: string, payload: Prisma.InputJsonValue) {
  await db.webhookEvent.upsert({
    where: { eventId },
    create: { eventId, provider: "lemonsqueezy", status, payload },
    update: { status, processedAt: new Date() },
  });
}

export async function POST(req: NextRequest) {
  const secret = getLemonSqueezyWebhookSecret();
  if (!secret) {
    console.error("[LS_WEBHOOK] LEMONSQUEEZY_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature = (req.headers.get("x-signature") ?? "").trim();
  if (!isValidSignature(rawBody, signature, secret)) {
    console.warn("[LS_WEBHOOK] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const envelope = webhookSchema.safeParse(json);
  if (!envelope.success) {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  const { meta, data } = envelope.data;
  const eventName = meta.event_name;
  const orderId = data.id;
  const payload = json as Prisma.InputJsonValue;

  const isOrderEvent = data.type === "orders" && (eventName === "order_created" || eventName === "order_refunded");
  const attrsResult = isOrderEvent ? orderAttributesSchema.safeParse(data.attributes) : null;
  const attrs = attrsResult?.success ? attrsResult.data : null;
  const eventId = idempotencyKey(eventName, orderId, attrs);

  if (isOrderEvent && !attrs) {
    await recordEvent(eventId, "rejected", payload);
    return NextResponse.json({ error: "Malformed order attributes" }, { status: 400 });
  }

  const expectedStore = getLemonSqueezyStoreId();
  if (attrs?.store_id && expectedStore && attrs.store_id !== expectedStore) {
    await recordEvent(eventId, "rejected", payload);
    return NextResponse.json({ received: true, ignored: "foreign store" }, { status: 200 });
  }

  const existing = await db.webhookEvent.findUnique({ where: { eventId }, select: { status: true } });
  if (existing && existing.status !== "failed") {
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
  }

  try {
    const outcome = await db.$transaction(async (tx): Promise<Outcome> => {
      let result: Outcome;
      if (eventName === "order_created" && attrs) {
        result = await handleOrderCreated(tx, orderId, attrs, meta.custom_data);
      } else if (eventName === "order_refunded" && attrs) {
        result = await handleOrderRefunded(tx, orderId, attrs);
      } else {
        result = { status: "ignored", detail: `unhandled event ${eventName}` };
      }

      await tx.webhookEvent.upsert({
        where: { eventId },
        create: { eventId, provider: "lemonsqueezy", status: result.status, payload },
        update: { status: result.status, processedAt: new Date() },
      });
      return result;
    });

    if (outcome.status === "rejected") {
      console.error(`[LS_WEBHOOK_REJECTED] ${eventId}: ${outcome.detail}`);
    } else {
      console.info(`[LS_WEBHOOK] ${eventId}: ${outcome.status} (${outcome.detail})`);
    }
    return NextResponse.json({ received: true, status: outcome.status }, { status: 200 });
  } catch (error: unknown) {
    // Unique constraint on referenceId/eventId => a concurrent delivery already won.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
    }

    console.error(`[LS_WEBHOOK_FAILED] ${eventId}:`, error);
    await recordEvent(eventId, "failed", payload).catch(() => undefined);
    // Non-2xx so Lemon Squeezy retries and the failure is visible in its dashboard.
    const status = error instanceof RetryableWebhookError ? 422 : 500;
    return NextResponse.json({ error: "Webhook processing failed" }, { status });
  }
}
