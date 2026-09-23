import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";

const agentsQuerySchema = z.object({
  state: z.string().length(2, "State code must be 2 characters").optional(),
  city: z.string().max(100, "City must be 100 characters or fewer").optional(),
  brokerage: z.string().max(200, "Brokerage must be 200 characters or fewer").optional(),
  minTransactions: z.coerce.number().int().nonnegative("Minimum transactions must be a non-negative integer").optional(),
  minVolume: z.coerce.number().nonnegative("Minimum volume must be a non-negative number").optional(),
  specialization: z.string().max(100, "Specialization must be 100 characters or fewer").optional(),
  verifiedOnly: z.coerce.boolean().optional(),
  q: z.string().max(100, "Search query must be 100 characters or fewer").optional(),
  page: z.coerce.number().int().positive("Page must be a positive integer").default(1),
  limit: z.coerce.number().int().min(1).max(100, "Limit must be between 1 and 100").default(25),
});

function maskEmail(email: string): string {
  if (!email) return "";
  const [user, domain] = email.split("@");
  return `${user.slice(0, 1)}***@${domain || "hidden.com"}`;
}

function maskPhone(phone: string): string {
  if (!phone) return "";
  return "+1 (***) ***-" + phone.slice(-4);
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const purchases = await db.leadPurchase.findMany({
    where: { userId: session.user.id, status: "COMPLETED" },
    select: { unlockedStates: true },
  });
  const unlockedStates = Array.from(new Set(purchases.flatMap((p) => p.unlockedStates)));

  const { searchParams } = new URL(request.url);

  const parsed = agentsQuerySchema.safeParse({
    state: searchParams.get("state") ?? undefined,
    city: searchParams.get("city") ?? undefined,
    brokerage: searchParams.get("brokerage") ?? undefined,
    minTransactions: searchParams.get("minTransactions") ?? undefined,
    minVolume: searchParams.get("minVolume") ?? undefined,
    specialization: searchParams.get("specialization") ?? undefined,
    verifiedOnly: searchParams.get("verifiedOnly") ?? undefined,
    q: searchParams.get("q") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }

  const { state, city, brokerage, minTransactions, minVolume, specialization, verifiedOnly, q, page, limit } = parsed.data;
  const sanitizedQ = (q ?? "").slice(0, 100).trim();
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  const andConditions: unknown[] = [
    { email: { not: null } },
    { email: { not: { equals: "" } } },
    { isDeliverable: true },
  ];

  if (state) andConditions.push({ state: state.toUpperCase() });
  if (city) andConditions.push({ city: { contains: city, mode: "insensitive" } });
  if (brokerage) andConditions.push({ brokerageName: { contains: brokerage, mode: "insensitive" } });
  if (minTransactions != null) andConditions.push({ transactionCount: { gte: minTransactions } });
  if (minVolume != null) andConditions.push({ totalVolume: { gte: minVolume } });
  if (specialization) andConditions.push({ specializations: { has: specialization } });
  if (verifiedOnly) andConditions.push({ isVerified: true });

  if (sanitizedQ) {
    andConditions.push({
      OR: [
        { fullName: { contains: sanitizedQ, mode: "insensitive" } },
        { email: { contains: sanitizedQ, mode: "insensitive" } },
        { brokerageName: { contains: sanitizedQ, mode: "insensitive" } },
      ],
    });
  }

  where.AND = andConditions;

  const [agents, total] = await Promise.all([
    db.agent.findMany({
      where,
      skip,
      take: limit,
      orderBy: { verificationScore: "desc" },
    }),
    db.agent.count({ where }),
  ]);

  const maskedAgents = agents.map((agent) => {
    const isUnlocked = unlockedStates.includes(agent.state ?? "");
    return {
      ...agent,
      email: isUnlocked ? agent.email : maskEmail(agent.email ?? ""),
      phone: isUnlocked ? agent.phone : maskPhone(agent.phone ?? ""),
      brokerageAddress: isUnlocked ? agent.brokerageAddress : "Locked - Purchase State Pack to View",
      isLocked: !isUnlocked,
    };
  });

  return NextResponse.json({
    agents: maskedAgents,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + limit < total,
    },
  });
}
