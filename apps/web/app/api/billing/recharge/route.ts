import { NextRequest, NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";
import {
  createLemonSqueezyCheckout,
  getLemonSqueezyStoreId,
  getWalletTopupVariantId,
  getLeadPurchaseVariantId,
} from "@/lib/lemon-squeezy";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { amount = 100, type = "WALLET_TOPUP", unlockedStates } = body;

    const amountNumber = Math.max(1, Number(amount) || 10);

    const storeId = getLemonSqueezyStoreId();
    const variantId =
      type === "LEAD_PURCHASE"
        ? getLeadPurchaseVariantId()
        : getWalletTopupVariantId();

    if (!storeId || !variantId) {
      return NextResponse.json(
        { error: "Lemon Squeezy store or variant is not configured" },
        { status: 500 }
      );
    }

    const origin =
      req.nextUrl.origin ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://leadsdombd-web.vercel.app";

    const checkoutUrl = await createLemonSqueezyCheckout({
      storeId,
      variantId,
      amount: amountNumber,
      userId: session.user.id,
      type,
      email: session.user.email ?? undefined,
      name: session.user.name ?? undefined,
      redirectUrl: `${origin}/dashboard/billing?status=success`,
      isPreview: process.env.NODE_ENV !== "production",
      unlockedStates: unlockedStates || undefined,
    });

    return NextResponse.json({ url: checkoutUrl }, { status: 200 });
  } catch (error: any) {
    console.error("[RECHARGE_ERROR]:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
