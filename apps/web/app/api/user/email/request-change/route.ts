import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";
import { checkRateLimit } from "@fine-leads/utils";
import { sendEmailChangeOtpEmail } from "@/lib/email";
import { generateOtp, otpIdentifiers, storeOtp } from "@/lib/otp";

const schema = z.object({ newEmail: z.string().trim().toLowerCase().email("A valid new email is required") });

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const { allowed } = checkRateLimit(`email-change-request:${userId}`, 3, 15 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests. Please try again in 15 minutes." }, { status: 429 });
    }

    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "A valid new email is required" }, { status: 400 });
    }
    const newEmail = parsed.data.newEmail;

    // Always use the DB as the source of truth for the current email (the session can be stale).
    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, passwordHash: true } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (!user.passwordHash) {
      return NextResponse.json({ error: "Email is managed by your Google account." }, { status: 400 });
    }
    const currentEmail = user.email.toLowerCase();

    if (newEmail === currentEmail) {
      return NextResponse.json({ error: "New email is the same as current email" }, { status: 400 });
    }
    const existingUser = await db.user.findUnique({ where: { email: newEmail }, select: { id: true } });
    if (existingUser) {
      return NextResponse.json({ error: "Email is already in use" }, { status: 409 });
    }

    const currentCode = generateOtp();
    const newCode = generateOtp();
    const currentId = otpIdentifiers.emailChangeCurrent(userId);
    const newId = otpIdentifiers.emailChangeNew(userId, newEmail);

    // Clear codes from any previous email-change attempt (possibly for a different new email).
    await db.verificationToken.deleteMany({ where: { identifier: { startsWith: `email-change:new:${userId}:` } } });
    await db.$transaction(async (tx) => {
      await storeOtp(currentId, currentCode, tx);
      await storeOtp(newId, newCode, tx);
    });

    const [currentResult, newResult] = await Promise.all([
      sendEmailChangeOtpEmail(currentEmail, currentCode, "current"),
      sendEmailChangeOtpEmail(newEmail, newCode, "new"),
    ]);
    if (("error" in currentResult && currentResult.error) || ("error" in newResult && newResult.error)) {
      await db.verificationToken.deleteMany({ where: { identifier: { in: [currentId, newId] } } });
      return NextResponse.json({ error: "We couldn't send the verification emails. Please try again." }, { status: 502 });
    }

    return NextResponse.json({ success: true, message: "Verification codes sent to both email addresses" });
  } catch (error) {
    console.error("Email change request error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
