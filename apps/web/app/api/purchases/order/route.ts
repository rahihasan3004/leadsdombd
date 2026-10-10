import { NextResponse, after } from "next/server";
import { z } from "zod";
import { auth } from "@fine-leads/auth";
import { db, Prisma } from "@fine-leads/database";
import { getLeadCreditCost } from "@fine-leads/utils";
import { LEAD_PURCHASE_MAX_QUANTITY, stateCodesSchema } from "@/lib/payments";
import { FULFILLMENT_CATEGORY } from "@/lib/scraper/fulfillment-policy";
import { processNextFulfillment } from "@/lib/scraper/order-fulfillment";
import { sendOrderProcessingEmail } from "@/lib/email/order-emails";
import {
  createQuantityLeadPurchase,
  OrderError,
  type OrderResult,
} from "@/lib/quantity-purchase";
export const maxDuration = 120;
const orderSchema = z.object({
  states: stateCodesSchema,
  category: z.literal(FULFILLMENT_CATEGORY).default(FULFILLMENT_CATEGORY),
  tier: z.enum(["PHONE_ONLY", "VERIFIED_EMAIL"]).default("VERIFIED_EMAIL"),
  quantity: z.coerce
    .number({ invalid_type_error: "Invalid quantity" })
    .int("Invalid quantity")
    .min(1, "Invalid quantity")
    .max(
      LEAD_PURCHASE_MAX_QUANTITY,
      `Maximum ${LEAD_PURCHASE_MAX_QUANTITY.toLocaleString()} leads per order`,
    ),
});

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = orderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid order" },
      { status: 400 },
    );
  }
  const { states, quantity, tier, category } = parsed.data;
  const requestedCredits = getLeadCreditCost(quantity, tier);

  try {
    // Fast, non-authoritative pre-check for a friendly error before scanning inventory.
    const current = await db.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    });
    if (!current) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (current.credits < requestedCredits) {
      return NextResponse.json(
        {
          error: "INSUFFICIENT_CREDITS",
          required: requestedCredits,
          current: current.credits,
        },
        { status: 402 },
      );
    }

    const result = await db.$transaction(
      async (tx): Promise<OrderResult> => {
        return createQuantityLeadPurchase(tx, {
          userId,
          states,
          quantity,
          tier,
          category,
          funding: { kind: "credits" },
        });
      },
      { maxWait: 10_000, timeout: 30_000 },
    );

    if (result.status === "PROCESSING") {
      // Next's lifecycle-aware after() starts dispatch AFTER the response, not a detached promise.
      // A recurring consumer still guarantees recovery, subsequent polling and verification.
      try {
        after(async () => {
          try {
            await sendOrderProcessingEmail(result.orderId);
          } catch {
            console.warn("[ORDER_EMAIL_DEFERRED]", {
              purchaseId: result.orderId,
              kind: "PROCESSING",
            });
          }
          try {
            await processNextFulfillment({ purchaseId: result.orderId });
          } catch {
            console.error(
              "[LOBSTR_DISPATCH_DEFERRED]: Durable job retained for the worker",
            );
          }
        });
      } catch {
        // Never report an accepted/charged order as failed if background registration is unavailable.
        console.error(
          "[LOBSTR_BACKGROUND_UNAVAILABLE]: Durable job retained for the worker",
        );
      }
    }
    return NextResponse.json(
      { success: true, ...result },
      { status: result.status === "PROCESSING" ? 202 : 200 },
    );
  } catch (err: unknown) {
    if (err instanceof OrderError) {
      return NextResponse.json(err.body, { status: err.status });
    }
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error:
            "Another order is in progress for these leads. Please try again.",
        },
        { status: 409 },
      );
    }
    console.error("[PURCHASE_ORDER_ERROR]:", err);
    return NextResponse.json(
      { error: "Failed to process lead purchase" },
      { status: 500 },
    );
  }
}
