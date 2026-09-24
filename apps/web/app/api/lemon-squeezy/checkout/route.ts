import { NextRequest, NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";
import { createCheckout, lemonSqueezySetup } from "@lemonsqueezy/lemonsqueezy.js";
import { getLemonSqueezyApiKey, getLemonSqueezyStoreId } from "@/lib/lemon-squeezy";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { amount = 100, type = "WALLET_TOPUP", unlockedStates } = body;

    const apiKey = getLemonSqueezyApiKey();
    const storeId = getLemonSqueezyStoreId() || "481404";
    const variantId = type === "LEAD_PURCHASE" ? "2160134" : "2160121";
    const storeSubdomain = "leadsdom";

    if (apiKey) {
      try {
        lemonSqueezySetup({ apiKey });
        const { data: checkoutData, error: checkoutError } = await createCheckout(
          storeId,
          variantId,
          {
            checkoutOptions: {
              embed: false,
              media: false,
            },
            checkoutData: {
              email: session.user.email || undefined,
              name: session.user.name || undefined,
              custom: {
                user_id: session.user.id,
                type: type,
                amount: String(amount),
                unlocked_states: unlockedStates ? JSON.stringify(unlockedStates) : undefined,
              },
            },
            customPrice: Math.round(Number(amount) * 100),
          }
        );

        if (!checkoutError && checkoutData?.data?.attributes?.url) {
          return NextResponse.json({ url: checkoutData.data.attributes.url });
        }
      } catch (sdkErr) {
        console.warn("[LEMON_SQUEEZY_SDK_FALLBACK]: Falling back to direct hosted checkout URL", sdkErr);
      }
    }

    const baseCheckoutUrl = type === "LEAD_PURCHASE"
      ? (process.env.LEMONSQUEEZY_LEAD_PURCHASE_CHECKOUT_URL || "https://leadsdom.lemonsqueezy.com/checkout/buy/4b07cd28-6666-4d91-bb67-6eec061a302b")
      : "https://leadsdom.lemonsqueezy.com/checkout/buy/4b07cd28-6666-4d91-bb67-6eec061a302b";

    const queryParams = new URLSearchParams();
    if (session.user.email) queryParams.set("checkout[email]", session.user.email);
    if (session.user.name) queryParams.set("checkout[name]", session.user.name);
    queryParams.set("checkout[custom][user_id]", session.user.id);
    queryParams.set("checkout[custom][type]", type);
    queryParams.set("checkout[custom][amount]", String(amount));
    if (unlockedStates) {
      queryParams.set("checkout[custom][unlocked_states]", JSON.stringify(unlockedStates));
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    queryParams.set("checkout[redirect_url]", `${appUrl}/dashboard/billing?success=true`);

    const finalUrl = `${baseCheckoutUrl}?${queryParams.toString()}`;
    return NextResponse.json({ url: finalUrl });
  } catch (error: any) {
    console.error("[CHECKOUT_ROUTE_ERROR]:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
