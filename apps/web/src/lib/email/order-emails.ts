import { randomUUID } from "node:crypto";
import { db, type Prisma } from "@fine-leads/database";
import { z } from "zod";
import { resend, EMAIL_FROM } from "../email";

export type OrderEmailKind = "PROCESSING" | "COMPLETED" | "FAILED";
const kindSchema = z.enum(["PROCESSING", "COMPLETED", "FAILED"]);
const payloadSchema = z.object({
  from: z.string().min(1),
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  html: z.string().min(1),
  text: z.string().min(1),
});
export interface OrderEmailDetails {
  referenceId: string;
  name: string | null;
  states: string[];
  quantity: number;
  deliveredCount: number;
  tier: "PHONE_ONLY" | "VERIFIED_EMAIL";
  creditsRefunded: number;
}
export interface EmailResult {
  success: boolean;
  status: string;
}
const SEND_TIMEOUT_MS = 8_000;
const LEASE_MS = 90_000;
const IDEMPOTENCY_RETRY_MS = 23 * 60 * 60 * 1000;

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
function vaultUrl(referenceId: string) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) throw new Error("APP_URL_NOT_CONFIGURED");
  const base = new URL(configured);
  const devLocal =
    process.env.NODE_ENV !== "production" &&
    base.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if (
    (!devLocal && base.protocol !== "https:") ||
    base.username ||
    base.password
  )
    throw new Error("INVALID_APP_URL");
  const url = new URL("/dashboard/lists", base.origin);
  // The Vault deep link filters referenceId, not the internal purchase ID.
  url.searchParams.set("order", referenceId);
  return url.toString();
}

/** Pure renderer: escaped, inline-styled HTML plus a readable plaintext fallback. */
export function buildOrderEmail(
  kind: OrderEmailKind,
  order: OrderEmailDetails,
) {
  const url = vaultUrl(order.referenceId);
  const tier = order.tier === "PHONE_ONLY" ? "Cold Calling" : "Full Outreach";
  const quantity = order.quantity.toLocaleString("en-US");
  const delivered = order.deliveredCount.toLocaleString("en-US");
  const refunded = order.creditsRefunded.toLocaleString("en-US");
  const heading =
    kind === "PROCESSING"
      ? "We’re collecting your leads"
      : kind === "COMPLETED"
        ? "Your leads are ready"
        : "Your order has been refunded";
  const message =
    kind === "PROCESSING"
      ? order.tier === "PHONE_ONLY"
        ? "We’re actively collecting and checking the phone and business details for your order. The Cold Calling pack does not include email addresses. We’ll email you when your leads are ready."
        : "We’re actively collecting and verifying your leads, including SMTP email deliverability checks. We’ll email you when your Full Outreach pack is ready."
      : kind === "COMPLETED"
        ? `Your order is complete: ${delivered} leads have been delivered to your Leads Vault. Open your order to view the leads and download the CSV.`
        : `We couldn’t complete this collection within our fulfillment requirements. Your full hold of ${refunded} credits has been refunded to your account. No action is needed.`;
  const rows: Array<[string, string]> = [
    ["Order ID", order.referenceId],
    ["Target States", order.states.join(", ")],
    ["Lead Package", tier],
    [
      kind === "COMPLETED" ? "Delivered Leads" : "Requested Leads",
      kind === "COMPLETED" ? delivered : quantity,
    ],
    ...(kind === "FAILED"
      ? [["Credits Refunded", refunded] as [string, string]]
      : []),
  ];
  const button =
    kind === "COMPLETED"
      ? "Open Leads Vault & Download CSV"
      : "View Your Order";
  const greeting = order.name?.trim()
    ? `Hi ${order.name.trim()},`
    : "Hi there,";
  const subjectRef = order.referenceId.replace(/[\r\n]/g, "").slice(0, 100);
  const subject = `${kind === "PROCESSING" ? "Order processing" : kind === "COMPLETED" ? "Your leads are ready" : "Order refunded"} — ${subjectRef} | LeadsDom`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:24px 12px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;"><tr><td style="padding:28px;">
<p style="margin:0 0 24px;color:#2563eb;font-size:20px;font-weight:700;">LeadsDom</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;">${escapeHtml(heading)}</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${escapeHtml(greeting)}</p>
<p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">${escapeHtml(message)}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border-radius:10px;">${rows.map(([label, value]) => `<tr><td style="padding:10px 14px;color:#64748b;font-size:13px;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:10px 14px;font-size:13px;font-weight:600;overflow-wrap:anywhere;">${escapeHtml(value)}</td></tr>`).join("")}</table>
<p style="margin:24px 0;"><a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 20px;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;border-radius:8px;">${escapeHtml(button)}</a></p>
<p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">Button not working? <a href="${escapeHtml(url)}" style="color:#2563eb;overflow-wrap:anywhere;">${escapeHtml(url)}</a></p>
<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;line-height:1.5;">This is a transactional update about your LeadsDom order. Sign in to your account to access your private leads.</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = [
    `LeadsDom — ${heading}`,
    greeting,
    message,
    ...rows.map(([label, value]) => `${label}: ${value}`),
    `${button}: ${url}`,
  ].join("\n\n");
  return { subject, html, text };
}

/** Called within the lifecycle transaction; no provider call or recipient lookup here. */
export function enqueueOrderEmail(
  tx: Pick<Prisma.TransactionClient, "orderEmailNotification">,
  purchaseId: string,
  kind: OrderEmailKind,
) {
  return tx.orderEmailNotification.upsert({
    where: { purchaseId_kind: { purchaseId, kind } },
    create: { purchaseId, kind },
    update: {},
  });
}

async function providerSend(
  payload: z.infer<typeof payloadSchema>,
  key: string,
) {
  if (!resend) throw new Error("RESEND_NOT_CONFIGURED");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // SDK v4 has no abort option. A timeout is ambiguous; retries reuse the persisted payload/key.
    return await Promise.race([
      resend.emails.send(payload, { idempotencyKey: key }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("EMAIL_TIMEOUT")),
          SEND_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function deliverNotification(id: string): Promise<EmailResult> {
  const token = randomUUID();
  let claimed = false;
  let attempts = 0;
  try {
    let row = await db.orderEmailNotification.findUnique({ where: { id } });
    if (!row) return { success: false, status: "NOT_FOUND" };
    if (row.status === "SENT") return { success: true, status: "ALREADY_SENT" };
    if (!["PENDING", "SENDING"].includes(row.status))
      return { success: false, status: row.status };
    attempts = row.attempts;
    const now = new Date();
    const claim = await db.orderEmailNotification.updateMany({
      where: {
        id,
        status: { in: ["PENDING", "SENDING"] },
        nextAttemptAt: { lte: now },
        OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
      },
      data: {
        status: "SENDING",
        leaseToken: token,
        leaseUntil: new Date(Date.now() + LEASE_MS),
      },
    });
    if (claim.count !== 1) return { success: false, status: "BUSY_OR_BACKOFF" };
    claimed = true;
    row = await db.orderEmailNotification.findUniqueOrThrow({ where: { id } });
    if (row.leaseToken !== token)
      return { success: false, status: "LEASE_LOST" };
    attempts = row.attempts + 1;
    const kind = kindSchema.parse(row.kind);
    const purchase = await db.leadPurchase.findUnique({
      where: { id: row.purchaseId },
      select: {
        referenceId: true,
        tier: true,
        status: true,
        leadCount: true,
        unlockedStates: true,
        user: { select: { email: true, name: true } },
        fulfillmentJob: { select: { creditsHeld: true } },
        _count: { select: { unlockedLeads: true } },
      },
    });
    const expected = kind === "FAILED" ? "REFUNDED" : kind;
    if (!purchase || purchase.status !== expected) {
      await db.orderEmailNotification.updateMany({
        where: { id, leaseToken: token },
        data: {
          status: "SKIPPED",
          leaseToken: null,
          leaseUntil: null,
          lastError: "STALE_ORDER_STATUS",
        },
      });
      return { success: false, status: "SKIPPED" };
    }
    if (
      kind === "COMPLETED" &&
      purchase._count.unlockedLeads < purchase.leadCount
    )
      throw new Error("ENTITLEMENTS_NOT_READY");
    if (kind === "FAILED" && !purchase.fulfillmentJob)
      throw new Error("REFUND_DETAILS_NOT_READY");
    if (
      row.firstAttemptAt &&
      Date.now() - row.firstAttemptAt.getTime() >= IDEMPOTENCY_RETRY_MS
    ) {
      await db.orderEmailNotification.updateMany({
        where: { id, leaseToken: token },
        data: {
          status: "NEEDS_REVIEW",
          leaseToken: null,
          leaseUntil: null,
          lastError: "IDEMPOTENCY_WINDOW_EXPIRED",
        },
      });
      return { success: false, status: "NEEDS_REVIEW" };
    }
    if (!resend) {
      attempts = row.attempts;
      throw new Error("RESEND_NOT_CONFIGURED");
    }
    const payload = row.payload
      ? payloadSchema.parse(row.payload)
      : {
          from: EMAIL_FROM,
          to: purchase.user.email,
          ...buildOrderEmail(kind, {
            referenceId: purchase.referenceId,
            name: purchase.user.name,
            states: purchase.unlockedStates,
            quantity: purchase.leadCount,
            deliveredCount: purchase._count.unlockedLeads,
            tier: purchase.tier,
            creditsRefunded: purchase.fulfillmentJob?.creditsHeld ?? 0,
          }),
        };
    payloadSchema.parse(payload);
    const prepared = await db.orderEmailNotification.updateMany({
      where: { id, leaseToken: token, leaseUntil: { gt: new Date() } },
      data: {
        payload,
        attempts,
        firstAttemptAt: row.firstAttemptAt ?? new Date(),
      },
    });
    if (prepared.count !== 1) return { success: false, status: "LEASE_LOST" };
    const response = await providerSend(
      payload,
      `order-email/${row.purchaseId}/${kind.toLowerCase()}`,
    );
    if (response.error || !response.data?.id)
      throw new Error("RESEND_REJECTED");
    const saved = await db.orderEmailNotification.updateMany({
      where: { id, leaseToken: token },
      data: {
        status: "SENT",
        providerId: response.data.id,
        sentAt: new Date(),
        leaseToken: null,
        leaseUntil: null,
        lastError: null,
      },
    });
    return {
      success: saved.count === 1,
      status: saved.count === 1 ? "SENT" : "LEASE_LOST",
    };
  } catch (error) {
    const known = [
      "RESEND_NOT_CONFIGURED",
      "EMAIL_TIMEOUT",
      "RESEND_REJECTED",
      "APP_URL_NOT_CONFIGURED",
      "INVALID_APP_URL",
      "ENTITLEMENTS_NOT_READY",
      "REFUND_DETAILS_NOT_READY",
    ];
    const code =
      error instanceof Error && known.includes(error.message)
        ? error.message
        : "ORDER_EMAIL_RETRY";
    if (claimed) {
      try {
        await db.orderEmailNotification.updateMany({
          where: { id, leaseToken: token },
          data: {
            attempts,
            status: attempts >= 8 ? "EXHAUSTED" : "PENDING",
            leaseToken: null,
            leaseUntil: null,
            lastError: code,
            nextAttemptAt: new Date(
              Date.now() +
                (code === "RESEND_NOT_CONFIGURED"
                  ? 600_000
                  : Math.min(300_000, 15_000 * 2 ** Math.max(0, attempts - 1))),
            ),
          },
        });
      } catch {
        /* Expiring lease recovers even when the DB cannot record this failure. */
      }
    }
    console.warn("[ORDER_EMAIL_DEFERRED]", { notificationId: id, code });
    return { success: false, status: "DEFERRED" };
  }
}

async function sendOrderEmail(
  purchaseId: string,
  kind: OrderEmailKind,
): Promise<EmailResult> {
  try {
    const notification = await enqueueOrderEmail(db, purchaseId, kind);
    return await deliverNotification(notification.id);
  } catch {
    console.warn("[ORDER_EMAIL_DEFERRED]", {
      purchaseId,
      kind,
      code: "OUTBOX_UNAVAILABLE",
    });
    return { success: false, status: "DEFERRED" };
  }
}
export const sendOrderProcessingEmail = (purchaseId: string) =>
  sendOrderEmail(purchaseId, "PROCESSING");
export const sendOrderCompletedEmail = (purchaseId: string) =>
  sendOrderEmail(purchaseId, "COMPLETED");
export const sendOrderFailedEmail = (purchaseId: string) =>
  sendOrderEmail(purchaseId, "FAILED");

/** Also runs when no fulfillment jobs remain, so terminal-status emails are retried. */
export async function processPendingOrderEmails(limit = 2) {
  const summary = { sent: 0, deferred: 0, skipped: 0 };
  try {
    const now = new Date();
    const rows = await db.orderEmailNotification.findMany({
      where: {
        status: { in: ["PENDING", "SENDING"] },
        nextAttemptAt: { lte: now },
        OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: Math.max(1, Math.min(5, Math.floor(limit))),
      select: { id: true },
    });
    for (const row of rows) {
      const result = await deliverNotification(row.id);
      if (result.success) summary.sent++;
      else if (result.status === "SKIPPED") summary.skipped++;
      else summary.deferred++;
    }
  } catch {
    console.warn("[ORDER_EMAIL_DEFERRED]", { code: "OUTBOX_SCAN_UNAVAILABLE" });
    summary.deferred++;
  }
  return summary;
}
