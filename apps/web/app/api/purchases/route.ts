import { NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";
import { PRICE_PER_LEAD, LEAD_STATES } from "@fine-leads/utils";

const STATE_NAME_TO_CODE: Record<string, string> = {};
for (const s of LEAD_STATES) {
  STATE_NAME_TO_CODE[s.name.toLowerCase()] = s.code;
}

function expandStateQuery(states: string[]): string[] {
  const expanded = new Set<string>();
  for (const s of states) {
    expanded.add(s);
    expanded.add(s.toUpperCase());
    const code = STATE_NAME_TO_CODE[s.toLowerCase()];
    if (code) expanded.add(code);
  }
  return Array.from(expanded);
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { states = [], baseUrl } = body;

    if (!states.length) {
      return NextResponse.json({ error: "No states selected" }, { status: 400 });
    }

    const existingPurchases = await db.leadPurchase.findMany({
      where: { userId: session.user.id, status: "COMPLETED" },
    });

    const purchasedStateCodes = existingPurchases.flatMap((p) => p.unlockedStates || []);

    const newStates = states.filter((s: string) => !purchasedStateCodes.includes(s));

    if (newStates.length === 0) {
      return NextResponse.json(
        { error: "All selected states already purchased" },
        { status: 400 },
      );
    }

    const leadCount = await db.agent.count({
      where: {
        state: { in: newStates },
        email: { not: null },
        isDeliverable: true,
      },
    });
    const finalAmount = Math.round(leadCount * PRICE_PER_LEAD * 100) / 100;

    console.log("[CHECKOUT REQUEST]:", { user: session?.user?.email, states, finalAmount, leadCount });

    const successUrl = `${baseUrl || ""}/dashboard?purchase=success`;

    return NextResponse.json({ url: successUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create checkout session";
    console.error("[CRITICAL CHECKOUT ERROR]:", err);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const purchases = await db.leadPurchase.findMany({
      where: { userId: session.user.id, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
    });

    const purchasedStates: string[] = purchases.flatMap((p) => p.unlockedStates || []);
    const uniquePurchasedStates = Array.from(new Set(purchasedStates));
    const totalAmountPaid = purchases.reduce((sum, p) => sum + p.amountPaid, 0);

    const stateQuery = expandStateQuery(uniquePurchasedStates);

    const leads = stateQuery.length > 0
      ? await db.agent.findMany({
          where: {
            state: { in: stateQuery },
            email: { not: null },
            isDeliverable: true,
          },
          orderBy: { rating: "desc" },
          take: 1000,
        })
      : [];

    return NextResponse.json({
      purchases,
      purchasedStates: uniquePurchasedStates,
      purchasedCount: uniquePurchasedStates.length,
      totalAmountPaid,
      upgradePrice: 0,
      canUpgrade: false,
      leads,
      totalUnlocked: leads.length,
    });
  } catch (error) {
    console.error("Purchase fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchases" },
      { status: 500 },
    );
  }
}