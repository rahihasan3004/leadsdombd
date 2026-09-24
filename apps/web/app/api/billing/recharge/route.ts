import { NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";
import { getLemonSqueezyStoreId } from "@/lib/lemon-squeezy";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const rawAmount = Number(body.amount);

    if (!rawAmount || isNaN(rawAmount) || !Number.isFinite(rawAmount)) {
      return NextResponse.json(
        { error: "Invalid recharge amount." },
        { status: 400 }
      );
    }

    if (rawAmount < 10) {
      return NextResponse.json(
        { error: "Minimum recharge is $10.00." },
        { status: 400 }
      );
    }

    if (rawAmount > 5000) {
      return NextResponse.json(
        { error: "Maximum single recharge is $5,000.00." },
        { status: 400 }
      );
    }

    const storeId = getLemonSqueezyStoreId();

    if (!storeId) {
      return NextResponse.json(
        { error: "Payment processing is currently unavailable." },
        { status: 503 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const res = await fetch(`${appUrl}/api/lemon-squeezy/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": req.headers.get("cookie") || "",
      },
      body: JSON.stringify({
        type: "WALLET_TOPUP",
        amount: rawAmount,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.url) {
      return NextResponse.json(
        { error: data.error || "Unable to process recharge. Please try again." },
        { status: res.status || 500 }
      );
    }

    return NextResponse.json({
      url: data.url,
    });
  } catch (err: unknown) {
    console.error(
      "[LEMON_SQUEEZY_RECHARGE_ERROR]:",
      err instanceof Error ? err.message : String(err),
      JSON.stringify(
        (err as { data?: unknown; errors?: unknown })?.data ||
          (err as { data?: unknown; errors?: unknown })?.errors ||
          {}
      )
    );
    return NextResponse.json(
      { error: "Recharge failed. Please try again." },
      { status: 500 }
    );
  }
}
