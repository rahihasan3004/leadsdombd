import { NextRequest, NextResponse, after } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { db, Prisma } from "@fine-leads/database";
import {
  getLemonSqueezyStoreId,
  getLemonSqueezyWebhookSecret,
} from "@/lib/lemon-squeezy";
import { verifyCheckoutCustomData, type PricedOrder } from "@/lib/payments";

import { createQuantityLeadPurchase } from "@/lib/quantity-purchase";
import { processNextFulfillment } from "@/lib/scraper/order-fulfillment";
import { sendOrderProcessingEmail } from "@/lib/email/order-emails";
export const maxDuration = 120;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/* Payload schema (only the fields we rely on)                         */
/* ------------------------------------------------------------------ */

const cents = z.coerce.number().int().nonnegative().safe();

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
type Outcome = {
  status: "processed" | "ignored" | "rejected" | "pending";
  detail: string;
  queuedPurchaseId?: string;
};

class RetryableWebhookError extends Error {}

function prismaFailureDetails(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      code: error.code,
      target: error.meta?.target ?? null,
      modelName: error.meta?.modelName ?? null,
      fieldName: error.meta?.field_name ?? null,
      databaseCode: error.meta?.code ?? null,
      message: error.message,
    };
  }
  return {
    code: null,
    target: null,
    message: error instanceof Error ? error.message : String(error),
  };
}

function canRetryTransaction(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === "P2034") return true; // Serialization/deadlock rollback.
  if (error.code !== "P2002") return false;
  const target = error.meta?.target;
  const fields = Array.isArray(target) ? target : [target];
  // Retry the whole rolled-back transaction, never just the credit increment.
  // The next attempt must find a committed deterministic payment/event reference.
  return fields.some(
    (field) =>
      typeof field === "string" &&
      /^(referenceId|eventId)$|(?:WalletTransaction_referenceId|LeadPurchase_referenceId|WebhookEvent_eventId)_key$/.test(
        field,
      ),
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function isValidSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest();
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
function idempotencyKey(
  eventName: string,
  orderId: string,
  a: OrderAttributes | null,
): string {
  if (eventName === "order_created") return `ls:order_created:${orderId}`;
  if (eventName === "order_refunded")
    return `ls:order_refunded:${orderId}:${a?.refunded_amount ?? 0}`;
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
  customData: unknown,
  alreadyFullyRefunded = false,
): Promise<Outcome> {
  if (attrs.status !== "paid") {
    return { status: "ignored", detail: `order status ${attrs.status}` };
  }

  const verified = verifyCheckoutCustomData(customData);
  if (!verified) {
    return {
      status: "rejected",
      detail: "custom data missing, unknown or signature mismatch",
    };
  }
  const { userId, order } = verified;

  const paid = netPaidUsdCents(attrs);
  if (paid < order.amountCents) {
    return {
      status: "rejected",
      detail: `underpaid: paid ${paid}c, expected ${order.amountCents}c`,
    };
  }

  // The checkout HMAC and payment amount were verified before resolving identity.
  // Invalid/missing unsigned custom data must never be upgraded by an email match.
  const validUserId = z
    .string()
    .max(191)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .safeParse(userId);
  let user = validUserId.success
    ? await tx.user.findUnique({ where: { id: userId }, select: { id: true } })
    : null;
  if (!user) {
    const email = z
      .string()
      .trim()
      .email()
      .max(254)
      .toLowerCase()
      .safeParse(attrs.user_email);
    if (email.success) {
      user = await tx.user.findUnique({
        where: { email: email.data },
        select: { id: true },
      });
      if (user)
        console.warn("[LS_WEBHOOK_USER_RESOLVED_BY_EMAIL]", { orderId });
    }
  }
  if (!user)
    throw new RetryableWebhookError(
      "Checkout user unavailable; no matching order email",
    );

  const queuedPurchaseId = await fulfillOrder(
    tx,
    user.id,
    orderId,
    order,
    alreadyFullyRefunded,
  );
  return {
    status: "processed",
    detail: `${order.type} fulfilled`,
    ...(queuedPurchaseId ? { queuedPurchaseId } : {}),
  };
}

async function fulfillOrder(
  tx: Tx,
  userId: string,
  orderId: string,
  order: PricedOrder,
  alreadyFullyRefunded: boolean,
) {
  const amountPaid = new Prisma.Decimal(order.amountCents).div(100);

  if (order.type === "LEAD_PURCHASE") {
    if (alreadyFullyRefunded) {
      await tx.leadPurchase.create({
        data: {
          userId,
          tier: order.tier,
          unlockedStates: order.states,
          leadCount: order.quantity,
          amountPaid,
          status: "REFUNDED",
          refundedAt: new Date(),
          referenceId: leadPurchaseRef(orderId),
        },
      });
      return;
    }
    const purchase = await createQuantityLeadPurchase(tx, {
      userId,
      states: order.states,
      quantity: order.quantity,
      tier: order.tier,
      funding: {
        kind: "card",
        referenceId: leadPurchaseRef(orderId),
        amountCents: order.amountCents,
      },
    });
    return purchase.status === "PROCESSING" ? purchase.orderId : undefined;
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
      metadata: {
        lsOrderId: orderId,
        tierId: order.tierId,
        amountCents: order.amountCents,
      },
    },
  });
}

async function handleOrderRefunded(
  tx: Tx,
  orderId: string,
  attrs: OrderAttributes,
): Promise<Outcome> {
  const isFull = isFullRefund(attrs);

  // Lead purchase paid by card: revoke access only on full refund.
  const purchase = await tx.leadPurchase.findUnique({
    where: { referenceId: leadPurchaseRef(orderId) },
    select: { id: true, status: true },
  });
  if (purchase) {
    if (!isFull)
      return {
        status: "processed",
        detail: "partial refund on lead purchase; access kept",
      };
    await tx.leadPurchase.updateMany({
      where: {
        id: purchase.id,
        status: { in: ["COMPLETED", "PROCESSING", "FAILED", "PENDING"] },
      },
      data: { status: "REFUNDED", refundedAt: new Date() },
    });
    await tx.unlockedLead.deleteMany({ where: { purchaseId: purchase.id } });
    // Updating the job row invalidates any worker lease before it can allocate data.
    await tx.leadFulfillmentJob.updateMany({
      where: { purchaseId: purchase.id },
      data: {
        status: "FAILED",
        leaseToken: null,
        leaseUntil: null,
        lastError: "CARD_PAYMENT_REFUNDED",
      },
    });
    await tx.orderEmailNotification.updateMany({
      where: {
        purchaseId: purchase.id,
        status: { in: ["PENDING", "SENDING"] },
      },
      data: {
        status: "SKIPPED",
        leaseToken: null,
        leaseUntil: null,
        lastError: "CARD_PAYMENT_REFUNDED",
      },
    });
    return { status: "processed", detail: "lead purchase revoked" };
  }

  // Wallet top-up (new deterministic ref, or legacy `ls_order_<id>_<ts>`).
  const topup = await tx.walletTransaction.findFirst({
    where: {
      type: "RECHARGE",
      OR: [
        { referenceId: topupRef(orderId) },
        { referenceId: { startsWith: `${topupRef(orderId)}_` } },
      ],
    },
    select: { id: true, userId: true, amount: true },
  });
  if (!topup)
    return { status: "pending", detail: "awaiting matching order_created" };

  const purchasedCredits = Math.trunc(Number(topup.amount));
  const targetRevoked =
    isFull || attrs.total === 0
      ? purchasedCredits
      : Number(
          (BigInt(purchasedCredits) *
            BigInt(Math.min(attrs.refunded_amount, attrs.total))) /
            BigInt(attrs.total),
        );

  const prior = await tx.walletTransaction.aggregate({
    where: {
      type: "ADJUSTMENT",
      metadata: { path: ["lsOrderId"], equals: orderId },
    },
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
        metadata: {
          lsOrderId: orderId,
          refundedAmountCents: attrs.refunded_amount,
          full: isFull,
        },
      },
    });
  }

  if (isFull) {
    await tx.walletTransaction.update({
      where: { id: topup.id },
      data: { status: "REFUNDED" },
    });
  }

  return { status: "processed", detail: `revoked ${toRevoke} credits` };
}

/* ------------------------------------------------------------------ */
/* Route                                                               */
/* ------------------------------------------------------------------ */

function isFullRefund(attrs: OrderAttributes) {
  // A refund flag alone does not prove that a cumulative partial refund is full.
  return (
    attrs.status === "refunded" ||
    (attrs.total > 0 && attrs.refunded_amount >= attrs.total)
  );
}
async function pendingRefunds(tx: Tx, orderId: string) {
  // Include historical ignored refunds so a provider retry can heal the previous bug.
  return tx.webhookEvent.findMany({
    where: {
      provider: "lemonsqueezy",
      eventId: { startsWith: `ls:order_refunded:${orderId}:` },
      status: { in: ["pending", "ignored"] },
    },
    orderBy: { processedAt: "asc" },
  });
}
function refundAttributes(
  payload: unknown,
  orderId: string,
): OrderAttributes | null {
  const envelope = webhookSchema.safeParse(payload);
  if (
    !envelope.success ||
    envelope.data.meta.event_name !== "order_refunded" ||
    envelope.data.data.type !== "orders" ||
    envelope.data.data.id !== orderId
  )
    return null;
  const attributes = orderAttributesSchema.safeParse(
    envelope.data.data.attributes,
  );
  return attributes.success ? attributes.data : null;
}
async function reconcileRefunds(
  tx: Tx,
  orderId: string,
  rows: Awaited<ReturnType<typeof pendingRefunds>>,
) {
  for (const row of rows) {
    const attrs = refundAttributes(row.payload, orderId);
    if (!attrs) continue;
    const outcome = await handleOrderRefunded(tx, orderId, attrs);
    await tx.webhookEvent.update({
      where: { eventId: row.eventId },
      data: { status: outcome.status, processedAt: new Date() },
    });
  }
}
async function recordEvent(
  eventId: string,
  status: string,
  payload: Prisma.InputJsonValue,
) {
  // Failure logging must never overwrite a concurrently committed successful event.
  await db.webhookEvent.upsert({
    where: { eventId },
    create: { eventId, provider: "lemonsqueezy", status, payload },
    update: {},
  });
  await db.webhookEvent.updateMany({
    where: { eventId, status: { in: ["failed", "pending"] } },
    data: { status, processedAt: new Date() },
  });
}

export async function POST(req: NextRequest) {
  const secret = getLemonSqueezyWebhookSecret();
  if (!secret) {
    console.error("[LS_WEBHOOK] LEMONSQUEEZY_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 },
    );
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

  const isOrderEvent =
    data.type === "orders" &&
    (eventName === "order_created" || eventName === "order_refunded");
  const attrsResult = isOrderEvent
    ? orderAttributesSchema.safeParse(data.attributes)
    : null;
  const attrs = attrsResult?.success ? attrsResult.data : null;
  const eventId = idempotencyKey(eventName, orderId, attrs);

  if (isOrderEvent && !attrs) {
    return NextResponse.json(
      { error: "Malformed order attributes" },
      { status: 400 },
    );
  }

  const expectedStore = getLemonSqueezyStoreId();
  if (attrs?.store_id && expectedStore && attrs.store_id !== expectedStore) {
    return NextResponse.json(
      { received: true, ignored: "foreign store" },
      { status: 200 },
    );
  }

  try {
    const processEvent = () =>
      db.$transaction(
        async (tx): Promise<Outcome> => {
          // Shared lock exists even before an order/top-up row exists. ReadCommitted reads
          // AFTER this lock see every prior committed cumulative refund and its ledger delta.
          await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`lemonsqueezy:order:${orderId}`}, 0))`;
          const existing = await tx.webhookEvent.findUnique({
            where: { eventId },
            select: { status: true },
          });
          const refunds =
            eventName === "order_created"
              ? await pendingRefunds(tx, orderId)
              : [];
          if (existing && ["processed", "rejected"].includes(existing.status)) {
            if (
              existing.status === "processed" &&
              eventName === "order_created"
            )
              await reconcileRefunds(tx, orderId, refunds);
            return { status: "ignored", detail: "duplicate" };
          }
          let result: Outcome;
          if (eventName === "order_created" && attrs) {
            // A legacy pre-existing deterministic payment reference is also idempotent.
            const verified = verifyCheckoutCustomData(meta.custom_data);
            const known =
              !verified || attrs.status !== "paid"
                ? null
                : verified.order.type === "LEAD_PURCHASE"
                  ? await tx.leadPurchase.findUnique({
                      where: { referenceId: leadPurchaseRef(orderId) },
                      select: { id: true },
                    })
                  : await tx.walletTransaction.findFirst({
                      where: { referenceId: topupRef(orderId) },
                      select: { id: true },
                    });
            result = known
              ? { status: "processed", detail: "existing payment reconciled" }
              : await handleOrderCreated(
                  tx,
                  orderId,
                  attrs,
                  meta.custom_data,
                  refunds.some((row) => {
                    const a = refundAttributes(row.payload, orderId);
                    return !!a && isFullRefund(a);
                  }),
                );
            if (result.status === "processed")
              await reconcileRefunds(tx, orderId, refunds);
          } else if (eventName === "order_refunded" && attrs) {
            result = await handleOrderRefunded(tx, orderId, attrs);
          } else {
            result = {
              status: "ignored",
              detail: `unhandled event ${eventName}`,
            };
          }
          await tx.webhookEvent.upsert({
            where: { eventId },
            create: {
              eventId,
              provider: "lemonsqueezy",
              status: result.status,
              payload,
            },
            update: { status: result.status, payload, processedAt: new Date() },
          });
          return result;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          maxWait: 10000,
          timeout: 30000,
        },
      );
    let outcome: Outcome;
    try {
      outcome = await processEvent();
    } catch (error) {
      if (!canRetryTransaction(error)) throw error;
      console.error(
        `[LS_WEBHOOK_TRANSACTION_RETRY] ${eventId}:`,
        prismaFailureDetails(error),
      );
      outcome = await processEvent(); // One bounded retry, with the same order lock.
    }
    if (outcome.queuedPurchaseId) {
      const purchaseId = outcome.queuedPurchaseId;
      try {
        after(async () => {
          try {
            await sendOrderProcessingEmail(purchaseId);
          } catch {
            console.warn("[LS_PROCESSING_EMAIL_DEFERRED]", { purchaseId });
          }
          try {
            await processNextFulfillment({ purchaseId });
          } catch {
            console.warn("[LS_FULFILLMENT_DEFERRED]", { purchaseId });
          }
        });
      } catch {
        console.warn("[LS_FULFILLMENT_DEFERRED]", { purchaseId });
      }
    }
    if (outcome.detail === "duplicate")
      return NextResponse.json(
        { received: true, duplicate: true },
        { status: 200 },
      );

    if (outcome.status === "rejected") {
      console.error(`[LS_WEBHOOK_REJECTED] ${eventId}: ${outcome.detail}`);
    } else {
      console.info(
        `[LS_WEBHOOK] ${eventId}: ${outcome.status} (${outcome.detail})`,
      );
    }
    return NextResponse.json(
      { received: true, status: outcome.status },
      { status: 200 },
    );
  } catch (error: unknown) {
    // A unique violation in allocation is not proof of a duplicated payment.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      try {
        const committed = await db.webhookEvent.findUnique({
          where: { eventId },
          select: { status: true },
        });
        if (committed?.status === "processed") {
          console.error(
            `[LS_WEBHOOK_DUPLICATE_CONFLICT] ${eventId}:`,
            prismaFailureDetails(error),
          );
          return NextResponse.json(
            { received: true, duplicate: true },
            { status: 200 },
          );
        }
      } catch (lookupError) {
        console.error(
          `[LS_WEBHOOK_DUPLICATE_LOOKUP_FAILED] ${eventId}:`,
          prismaFailureDetails(lookupError),
        );
      }
    }

    console.error(
      `[LS_WEBHOOK_FAILED] ${eventId}:`,
      prismaFailureDetails(error),
    );
    await recordEvent(eventId, "failed", payload).catch(
      (recordError: unknown) => {
        console.error(
          `[LS_WEBHOOK_EVENT_RECORD_FAILED] ${eventId}:`,
          prismaFailureDetails(recordError),
        );
      },
    );
    // Missing/deleted users and FK races receive a clean, retryable response.
    // Do not acknowledge success: failed atomic mutations must be redelivered.
    const missingRelation =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2003", "P2025"].includes(error.code);
    const status =
      error instanceof RetryableWebhookError || missingRelation ? 422 : 500;
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status },
    );
  }
}
