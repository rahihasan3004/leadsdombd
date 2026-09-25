import { NextRequest, NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { amount = 100, type = "WALLET_TOPUP", unlockedStates } = body;

    const amountNumber = Math.max(1, Number(amount) || 10);
    const customPriceInCents = Math.round(amountNumber * 100);

    const WALLET_TOPUP_URL = "https://leadsdom.lemonsqueezy.com/checkout/buy/4b07cd28-6666-4d91-bb67-6eec061a302b";
    const LEAD_PURCHASE_URL = "https://leadsdom.lemonsqueezy.com/checkout/buy/4b07cd28-6666-4d91-bb67-6eec061a302b";

    const baseCheckoutUrl = type === "LEAD_PURCHASE" ? LEAD_PURCHASE_URL : WALLET_TOPUP_URL;

    const queryParams = new URLSearchParams();
    if (session.user.email) queryParams.set("checkout[email]", session.user.email);
    if (session.user.name) queryParams.set("checkout[name]", session.user.name);
    queryParams.set("checkout[custom][user_id]", session.user.id);
    queryParams.set("checkout[custom][type]", type);
    queryParams.set("checkout[custom][amount]", String(amountNumber));
    queryParams.set("checkout[custom_price]", String(customPriceInCents));
    queryParams.set("checkout[price]", String(customPriceInCents));
    if (unlockedStates) {
      queryParams.set("checkout[custom][unlocked_states]", JSON.stringify(unlockedStates));
    }

    const origin = req.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || "https://leadsdombd-web.vercel.app";
    queryParams.set("checkout[redirect_url]", `${origin}/dashboard/billing?status=success`);

    const finalCheckoutUrl = `${baseCheckoutUrl}?${queryParams.toString()}`;
    return NextResponse.json({ url: finalCheckoutUrl }, { status: 200 });
  } catch (error: any) {
    console.error("[RECHARGE_ERROR]:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
