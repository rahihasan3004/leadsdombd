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
    const page = Math.max(
      DEFAULT_PAGE,
      parseInt(searchParams.get("page") || String(DEFAULT_PAGE), 10)
    );
    const rawLimit = parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10);
    const limit = Math.min(MAX_LIMIT, Math.max(1, rawLimit));
    const skip = (page - 1) * limit;

    let purchases: any[] = [];
    let totalPurchases = 0;

    try {
      purchases = await db.leadPurchase.findMany({
        where: { userId: session.user.id, status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      });

      totalPurchases = await db.leadPurchase.count({
        where: { userId: session.user.id, status: "COMPLETED" },
      });
    } catch (err) {
      console.error("Purchase fetch error:", err);
      return NextResponse.json(
        { error: "Failed to fetch purchases" },
        { status: 500 },
      );
    }

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

      const leads = (purchase.unlockedLeads || [])
        .map((ul) => ul.agent)
        .filter(Boolean);

      return NextResponse.json({
        purchase,
        leads,
        pagination: {
          total: 1,
          pages: 1,
          currentPage: 1,
          limit: leads.length,
        },
      });
    }

    if (purchases.length === 0) {
      return NextResponse.json({
        purchases: [],
        leads: [],
        pagination: {
          total: 0,
          pages: 0,
          currentPage: page,
          limit,
        },
      });
    }

    const purchasedStates: string[] = purchases.flatMap((p) => p.unlockedStates || []);
    const uniquePurchasedStates = Array.from(new Set(purchasedStates));
    const totalAmountPaid = purchases.reduce((sum, p) => sum + Number(p.amountPaid), 0);

    const unlockedLeads = await db.unlockedLead.findMany({
      where: { userId: session.user.id },
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
    });

    const leads = unlockedLeads
      .map((ul) => ul.agent)
      .filter((agent): agent is NonNullable<typeof agent> => Boolean(agent));

    return NextResponse.json({
      purchases,
      purchasedStates: uniquePurchasedStates,
      purchasedCount: uniquePurchasedStates.length,
      totalAmountPaid,
      upgradePrice: 0,
      canUpgrade: false,
      leads,
      totalUnlocked: leads.length,
      pagination: {
        page,
        limit,
        total: totalPurchases,
        totalPages: Math.ceil(totalPurchases / limit),
        hasMore: skip + limit < totalPurchases,
      },
    });
  } catch (error) {
    console.error("Purchase fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchases" },
      { status: 500 },
    );
  }
}