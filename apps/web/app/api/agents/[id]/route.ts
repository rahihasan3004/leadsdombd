import { NextRequest, NextResponse } from "next/server";
import { db } from "@fine-leads/database";
import { auth } from "@fine-leads/auth";

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

    // Check if the user has unlocked the state for this agent
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
      isUnlocked = allUnlocked.includes(agent.state.toUpperCase());
    }

    // Safe role check
    const userRole = session?.user.role;
    const isAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN";

    // Mask data if not unlocked and not admin
    if (!isUnlocked && !isAdmin) {
      return NextResponse.json({
        ...agent,
        email: agent.email
          ? `${agent.email.slice(0, 1)}***@${
              agent.email.split("@")[1] || "domain.com"
            }`
          : null,
        phone: agent.phone ? `+1 (***) ***-${agent.phone.slice(-4)}` : null,
        brokerageAddress: "Locked - Purchase State Pack to View",
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