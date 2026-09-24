import crypto from "crypto";
import { NextResponse } from "next/server";
import { db } from "@fine-leads/database";
import { getLemonSqueezyWebhookSecret } from "@/lib/lemon-squeezy";
import { generateOrderRef, generateTxnRef } from "@fine-leads/utils";
import { refundLeadPurchase } from "@/lib/refund";

export async function POST(request: Request) {
  const bodyBuffer = await request.arrayBuffer();
  const body = Buffer.from(bodyBuffer).toString("utf-8");
  const signature = request.headers.get("x-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  const webhookSecret = getLemonSqueezyWebhookSecret();
  const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(body).digest("hex");
  const computedSignature = `sha256=${expectedSignature}`;

  if (signature.length !== computedSignature.length) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let isEqual = false;
  try {
    const sigBuffer = Buffer.from(signature);
    const computedBuffer = Buffer.from(computedSignature);
    if (sigBuffer.length === computedBuffer.length) {
      isEqual = crypto.timingSafeEqual(sigBuffer, computedBuffer);
    }
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (!isEqual) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let eventData: {
    event_name: string;
    meta: { event_id: string };
    data: {
      attributes: {
        custom?: Record<string, unknown>;
      };
    };
  };

  try {
    eventData = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const eventName = eventData.event_name;
  const eventId = eventData.meta.event_id;
  const customData = eventData.data?.attributes?.custom || {};

  const userId = String(customData.userId || customData.user_id || "");
  const type = String(customData.type || "");
  const amount = Number(customData.amount || 0);

  let targetUnlockedStates: string[] = [];
  if (customData.unlockedStates && Array.isArray(customData.unlockedStates)) {
    targetUnlockedStates = customData.unlockedStates.map((s) => String(s));
  }

  if (!eventId) {
    return NextResponse.json({ error: "Missing event ID" }, { status: 400 });
  }

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.webhookEvent.findUnique({
        where: { eventId },
      });

      if (existing) {
        return;
      }

      await tx.webhookEvent.create({
        data: {
          eventId,
          provider: "lemonsqueezy",
          status: "processing",
          payload: eventData as any,
        },
      });

      if (eventName === "order_created") {
        if (type === "WALLET_TOPUP") {
          const topupAmount = Math.round(amount * 100) / 100;

          if (topupAmount > 0 && userId) {
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
                description: `Wallet Top-Up via Lemon Squeezy (+$${topupAmount.toFixed(2)})`,
                status: "COMPLETED",
              },
            });
          }
        } else if (type === "LEAD_PURCHASE") {
          if (targetUnlockedStates.length > 0 && userId) {
            const existingPurchases = await tx.leadPurchase.findMany({
              where: { userId, status: "COMPLETED" },
              select: { unlockedStates: true },
            });

            const existingStates = new Set(
              existingPurchases.flatMap((p) => p.unlockedStates)
            );

            const newStateCodes = targetUnlockedStates.filter(
              (code) => !existingStates.has(code)
            );

            if (newStateCodes.length > 0) {
              const packPrice = Math.round(amount * 100) / 100;

              const purchase = await tx.leadPurchase.create({
                data: {
                  referenceId: generateOrderRef(),
                  userId,
                  unlockedStates: newStateCodes,
                  amountPaid: packPrice,
                  status: "COMPLETED",
                },
              });

              const actualLeadCount = await tx.agent.count({
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
                  packPrice,
                  "No leads available for the purchased states. Purchase has been refunded to your wallet.",
                  tx
                );
              }
            }
          }
        }
      }

      await tx.webhookEvent.update({
        where: { eventId },
        data: { status: "processed" },
      });
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler error" },
      { status: 500 }
    );
  }
}
