import { NextResponse } from "next/server";
import { db } from "@fine-leads/database";
import { z } from "zod";
import crypto from "crypto";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  message: z.string().min(1, "Message is required"),
  subject: z.string().optional(),
});

export async function POST(request: Request) {
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
