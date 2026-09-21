import { NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";

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

  const state = searchParams.get("state");
  const city = searchParams.get("city");
  const brokerage = searchParams.get("brokerage");
  const minTransactions = searchParams.get("minTransactions");
  const minVolume = searchParams.get("minVolume");
  const specialization = searchParams.get("specialization");
  const verifiedOnly = searchParams.get("verifiedOnly") === "true";
  const rawQ = searchParams.get("q") || "";
  const sanitizedQ = rawQ.slice(0, 100).trim();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 25));
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
  if (minTransactions) andConditions.push({ transactionCount: { gte: Number(minTransactions) } });
  if (minVolume) andConditions.push({ totalVolume: { gte: Number(minVolume) } });
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