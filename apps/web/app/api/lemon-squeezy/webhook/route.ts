import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@fine-leads/database";
import { getLemonSqueezyWebhookSecret } from "@/lib/lemon-squeezy";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = (req.headers.get("x-signature") || "").trim();
    const secret = (getLemonSqueezyWebhookSecret() || process.env.LEMONSQUEEZY_WEBHOOK_SECRET || "leadsdom_webhook_secret_2026").trim();

    const hmac = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");

    let isSignatureValid = false;
    try {
      const signatureBuffer = Buffer.from(signature, "hex");
      const hmacBuffer = Buffer.from(hmac, "hex");
      if (signatureBuffer.length === hmacBuffer.length) {
        isSignatureValid = crypto.timingSafeEqual(signatureBuffer, hmacBuffer);
      }
    } catch {
      isSignatureValid = (signature === hmac);
    }

    if (!isSignatureValid && process.env.NODE_ENV === "production") {
      console.error("[WEBHOOK_SIG_FAILED]: Signature mismatch.", { received: signature, computed: hmac });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const eventName = body.meta?.event_name;
    const customData = body.meta?.custom_data || {};
    const userId = customData.user_id || customData.userId;
    const attributes = body.data?.attributes || {};
    const userEmail = attributes.user_email || customData.email;

    console.log(`[LS_WEBHOOK_SUCCESS]: Event: ${eventName}, User: ${userEmail}, Amount: ${attributes.total_usd || attributes.total}`);

    if (eventName === "order_created") {
      const totalCents = attributes.total_usd ?? attributes.total ?? (Number(customData.amount || 100) * 100);
      const paidAmount = Number(totalCents) / 100;
      const orderId = String(attributes.first_order_item?.order_id || body.data?.id || Date.now());

      await db.$transaction(async (tx) => {
        const targetUser = await tx.user.findFirst({
          where: {
            OR: [
              ...(userId ? [{ id: String(userId) }] : []),
              ...(userEmail ? [{ email: { equals: String(userEmail).trim(), mode: "insensitive" } }] : []),
            ],
          },
        });

        if (!targetUser) {
          console.error(`[WEBHOOK_USER_NOT_FOUND]: ${userEmail}`);
          return;
        }

        if (paidAmount > 0) {
          const updatedUser = await tx.user.update({
            where: { id: targetUser.id },
            data: {
              walletBalance: {
                increment: paidAmount,
              },
            },
          });

          await tx.walletTransaction.create({
            data: {
              userId: targetUser.id,
              amount: paidAmount,
              type: "TOPUP",
              status: "COMPLETED",
              balanceAfter: updatedUser.walletBalance,
              description: `Wallet top-up via Lemon Squeezy (Order #${orderId})`,
            },
          });

          console.log(`[WALLET_CREDITED]: Added $${paidAmount} to ${targetUser.email}. New Balance: $${updatedUser.walletBalance}`);
        }
      });
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error("[WEBHOOK_ERROR]:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
