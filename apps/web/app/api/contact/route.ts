import { NextResponse } from "next/server";
import { db } from "@fine-leads/database";
import { z } from "zod";
import { getClientIp } from "@fine-leads/utils";
import { rateLimitOrNull } from "@/lib/rate-limit-response";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Name is too long"),
  email: z.string().trim().min(1, "Email is required").max(320).email("Invalid email address"),
  message: z.string().trim().min(1, "Message is required").max(5000, "Message is too long (max 5000 characters)"),
  subject: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  const limited = await rateLimitOrNull(
    `contact:${getClientIp(request)}`,
    5,
    15 * 60 * 1000,
    "Too many messages. Please try again in a few minutes."
  );
  if (limited) return limited;

  try {
    const body = await request.json();
    const parsed = contactSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const { name, email, message, subject } = parsed.data;
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      null;

    await db.auditLog.create({
      data: {
        action: "support_ticket_created",
        resource: "SupportTicket",
        details: {
          name,
          email,
          subject: subject || null,
          message,
        },
        ipAddress: ipAddress || undefined,
      },
    });

    return NextResponse.json(
      { success: true, message: "Support ticket submitted!" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Support ticket error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
