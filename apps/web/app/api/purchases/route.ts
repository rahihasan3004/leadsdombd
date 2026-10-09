import { NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";
import { db, type Prisma } from "@fine-leads/database";
import { redactLeadForTier } from "@/lib/lead-access";
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

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

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

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    const successUrl = `${appUrl}/dashboard?purchase=success`;


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

    const { searchParams } = new URL(request.url);
    const purchaseId = searchParams.get("purchaseId") || undefined;
    if (purchaseId) {
      const purchase = await db.leadPurchase.findFirst({
        where: { id: purchaseId, userId: session.user.id, status: "COMPLETED" },
        include: {
          unlockedLeads: {
            include: {
              agent: {
                select: {
                  id: true,
                  fullName: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                  officePhone: true,
                  brokerageName: true,
                  city: true,
                  state: true,
                  zipCode: true,
                  county: true,
                  category: true,
                  rating: true,
                  reviewCount: true,
                  timezone: true,
                  googlePlaceId: true,
                  googleMapsLink: true,
                  scrapedAt: true,
                  verificationScore: true,
                  dataSource: true,
                  photoUrl: true,
                  websiteUrl: true,
                  brokerageAddress: true,
                  licenseNumber: true,
                  licenseState: true,
                  licenseStatus: true,
                  licenseExpiry: true,
                  nmlsId: true,
                  marketArea: true,
                  propertyTypes: true,
                  transactionCount: true,
                  totalVolume: true,
                  averagePrice: true,
                  yearsExperience: true,
                  specializations: true,
                  bio: true,
                  socialProfiles: true,
                  lastVerifiedAt: true,
                  isVerified: true,
                  emailStatus: true,
                  isDeliverable: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
          },
        },
      });

      if (!purchase) {
        return NextResponse.json(
          { error: "Purchase not found" },
          { status: 404 },
        );
      }

      // Avoid serializing the same full agent records twice.
      const { unlockedLeads, ...purchaseSummary } = purchase;
      const purchaseWithQuantity = {
        ...purchaseSummary,
        quantity: purchase.leadCount ?? unlockedLeads.length,
      };

      const leads = (purchase.unlockedLeads || [])
        .map((ul) => redactLeadForTier(ul.agent, purchase.tier))
        .filter(Boolean);


      return NextResponse.json({
        purchase: purchaseWithQuantity,
        leads,
        pagination: {
          total: 1,
          pages: 1,
          currentPage: 1,
          limit: leads.length,
        },
      });
    }


    const page = Number(searchParams.get("page") ?? DEFAULT_PAGE);
    const rawLimit = Number(searchParams.get("limit") ?? DEFAULT_LIMIT);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(rawLimit) || rawLimit < 1) {
      return NextResponse.json({ error: "Invalid pagination" }, { status: 400 });
    }
    const limit = Math.min(MAX_LIMIT, rawLimit);
    const skip = (page - 1) * limit;
    if (!Number.isSafeInteger(skip)) {
      return NextResponse.json({ error: "Invalid pagination" }, { status: 400 });
    }
    const q = (searchParams.get("q") ?? "").trim().slice(0, 100);
    const matchingStates = LEAD_STATES
      .filter((state) => state.code.toLowerCase().includes(q.toLowerCase()))
      .map((state) => state.code);
    const where: Prisma.LeadPurchaseWhereInput = {
      userId: session.user.id,
      status: "COMPLETED",
      ...(q ? { OR: [
        { referenceId: { contains: q, mode: "insensitive" } },
        ...(matchingStates.length ? [{ unlockedStates: { hasSome: matchingStates } }] : []),
      ] } : {}),
    };

    const [purchases, totalPurchases] = await Promise.all([
      db.leadPurchase.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: limit,
        select: {
          id: true,
          referenceId: true,
          tier: true,
          state: true,
          unlockedStates: true,
          amountPaid: true,
          leadCount: true,
          status: true,
          createdAt: true,
          _count: { select: { unlockedLeads: true } },
        },
      }),
      db.leadPurchase.count({ where }),
    ]);
    const mappedPurchases = purchases.map(({ _count, amountPaid, ...purchase }) => ({
      ...purchase,
      amountPaid: Number(amountPaid),
      quantity: purchase.leadCount ?? _count.unlockedLeads,
    }));

    // Collection requests return order summaries only. Lead details are opt-in via purchaseId.
    return NextResponse.json({
      purchases: mappedPurchases,
      pagination: {
        page,
        limit,
        total: totalPurchases,
        totalPages: Math.ceil(totalPurchases / limit),
        hasMore: skip + purchases.length < totalPurchases,
      },
    });
  } catch (error) {
    console.error("Purchase fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch purchases" }, { status: 500 });
  }
}
