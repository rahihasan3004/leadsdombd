import { NextRequest, NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";
import { getCheckoutRedirectUrl } from "@/lib/checkout-url";
import {
  createLemonSqueezyCheckout,
  getLeadPurchaseVariantId,
  getLemonSqueezyStoreId,
  getWalletTopupVariantId,
} from "@/lib/lemon-squeezy";
import {
  buildCheckoutCustomData,
  checkoutRequestSchema,
  priceOrder,
  PricingError,
} from "@/lib/payments";

/**
 * Shared POST handler for /api/billing/recharge and /api/lemon-squeezy/checkout.
 * Accepts only { type: "WALLET_TOPUP", tierId } or
 * { type: "LEAD_PURCHASE", states, quantity }. Any client-sent amount/credits is ignored.
 */
export async function handleCheckoutRequest(
  req: NextRequest,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await req.json().catch(() => null);
    const parsed = checkoutRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Invalid checkout request",
        },
        { status: 400 },
      );
    }

    const order = priceOrder(parsed.data);

    const storeId = getLemonSqueezyStoreId();
    const variantId =
      order.type === "LEAD_PURCHASE"
        ? getLeadPurchaseVariantId()
        : getWalletTopupVariantId();
    if (!storeId || !variantId) {
      return NextResponse.json(
        { error: "Payments are not configured" },
        { status: 500 },
      );
    }

    const url = await createLemonSqueezyCheckout({
      storeId,
      variantId,
      amountCents: order.amountCents,
      customData: buildCheckoutCustomData(session.user.id, order),
      email: session.user.email ?? undefined,
      name: session.user.name ?? undefined,
      redirectUrl: getCheckoutRedirectUrl(),
      isPreview: process.env.NODE_ENV !== "production",
    });

    return NextResponse.json({ url }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof PricingError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[CHECKOUT_ERROR]:", error);
    return NextResponse.json(
      { error: "Unable to start checkout" },
      { status: 500 },
    );
  }
}
