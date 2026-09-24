import { NextRequest, NextResponse } from "next/server";
import { db } from "@fine-leads/database";
import { auth } from "@fine-leads/auth";

function maskEmail(email: string): string {
  if (!email) return "";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const maskedLocal =
    local.length <= 2
      ? "*".repeat(local.length)
      : local.slice(0, 2) + "*".repeat(Math.max(local.length - 2, 3));
  return `${maskedLocal}@${domain}`;
}

function maskPhone(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "*".repeat(digits.length);
  return "*".repeat(digits.length - 4) + digits.slice(-4);
}

const PUBLIC_FIELDS = [
  "id",
  "fullName",
  "city",
  "state",
  "brokerageName",
  "category",
  "rating",
  "reviewCount",
  "isDeliverable",
] as const;

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const session = await auth();

    const agent = await db.agent.findUnique({
      where: { id },
      include: {
        agentActivities: {
          take: 10,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    let isUnlocked = false;
    if (session?.user?.id && agent.state) {
      const purchases = await db.leadPurchase.findMany({
        where: {
          userId: session.user.id,
          status: "COMPLETED",
        },
        select: { unlockedStates: true },
      });

      const allUnlocked = purchases.flatMap(
        (p: { unlockedStates: string[] }) => p.unlockedStates
      );
      const hasPurchaseUnlock = allUnlocked.includes(agent.state.toUpperCase());

      const subscription = await db.subscription.findFirst({
        where: {
          userId: session.user.id,
          status: "ACTIVE",
        },
        select: { id: true },
      });

      isUnlocked = hasPurchaseUnlock || Boolean(subscription);
    }

    const userRole = session?.user.role;
    const isAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN";

    if (!isUnlocked && !isAdmin) {
      return NextResponse.json({
        id: agent.id,
        fullName: agent.fullName,
        city: agent.city,
        state: agent.state,
        brokerageName: agent.brokerageName,
        category: agent.category,
        rating: agent.rating,
        reviewCount: agent.reviewCount,
        isDeliverable: agent.isDeliverable,
        email: maskEmail(agent.email ?? ""),
        phone: maskPhone(agent.phone ?? ""),
        isUnlocked: false,
      });
    }

    return NextResponse.json(agent);
  } catch (error) {
    console.error("[AGENT_DETAIL_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
