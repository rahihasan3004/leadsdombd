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

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const purchases = await db.leadPurchase.findMany({
    where: { userId: session.user.id, status: "COMPLETED" },
    select: { unlockedStates: true },
  });
  const unlockedStates = Array.from(new Set(purchases.flatMap((p) => p.unlockedStates)));

  const agent = await db.agent.findUnique({
    where: { id: params.id, isDeliverable: true },
    include: { agentActivities: { orderBy: { createdAt: "desc" }, take: 10 } },
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const isUnlocked = unlockedStates.includes(agent.state ?? "");

  const maskedAgent = {
    ...agent,
    email: isUnlocked ? agent.email : maskEmail(agent.email ?? ""),
    phone: isUnlocked ? agent.phone : maskPhone(agent.phone ?? ""),
    brokerageAddress: isUnlocked ? agent.brokerageAddress : "Locked - Purchase State Pack to View",
    isLocked: !isUnlocked,
  };

  return NextResponse.json({ agent: maskedAgent });
}