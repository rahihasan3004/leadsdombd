import { NextRequest, NextResponse } from "next/server";
import { db } from "@fine-leads/database";
import { auth } from "@fine-leads/auth";
import { getAgentLeadAccess, redactLeadForTier } from "@/lib/lead-access";
import type { LeadTier } from "@fine-leads/utils";

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
  props: { params: Promise<{ id: string }> },
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

    let tier: LeadTier | undefined;
    if (session?.user?.id) {
      tier = (await getAgentLeadAccess(session.user.id, [agent])).get(agent.id);
    }
    const isUnlocked = tier !== undefined;
    // Raw admin access must use a fresh principal, not a potentially stale JWT role.
    let isAdmin = false;
    if (
      session?.user?.id &&
      ["ADMIN", "SUPER_ADMIN"].includes(session.user.role)
    ) {
      const principal = await db.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, tokenVersion: true },
      });
      isAdmin =
        !!principal &&
        ["ADMIN", "SUPER_ADMIN"].includes(principal.role) &&
        principal.tokenVersion === (session.user.tokenVersion ?? 0);
    }

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

    return NextResponse.json(isAdmin ? agent : redactLeadForTier(agent, tier!));
  } catch (error) {
    console.error("[AGENT_DETAIL_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
