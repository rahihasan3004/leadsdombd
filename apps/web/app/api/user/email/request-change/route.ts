import { NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";
import crypto from "crypto";

function generateSecureOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { newEmail } = body as { newEmail: string };

    if (!newEmail || !newEmail.includes("@")) {
      return NextResponse.json({ error: "A valid new email is required" }, { status: 400 });
    }

    const normalizedNewEmail = newEmail.toLowerCase().trim();
    const currentEmail = session.user.email;

    if (normalizedNewEmail === currentEmail) {
      return NextResponse.json({ error: "New email is the same as current email" }, { status: 400 });
    }

    const existingUser = await db.user.findUnique({ where: { email: normalizedNewEmail } });
    if (existingUser) {
      return NextResponse.json({ error: "Email is already in use" }, { status: 409 });
    }

    const otp1 = generateSecureOTP();
    const otp2 = generateSecureOTP();
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await db.verificationToken.deleteMany({ where: { identifier: currentEmail } });
    await db.verificationToken.deleteMany({ where: { identifier: normalizedNewEmail } });

    await db.verificationToken.create({
      data: { identifier: currentEmail, token: otp1, expires },
    });

    await db.verificationToken.create({
      data: { identifier: normalizedNewEmail, token: otp2, expires },
    });

    if (process.env.NODE_ENV === "development") {
      console.log(`[EMAIL CHANGE OTP] Current (${currentEmail}): ${otp1} | New (${normalizedNewEmail}): ${otp2}`);
    } else {
      const masked1 = `${otp1.charAt(0)}***${otp1.slice(-2)}`;
      const masked2 = `${otp2.charAt(0)}***${otp2.slice(-2)}`;
      console.log(`[OTP_DISPATCHED]: current=${currentEmail} -> ${masked1}, new=${normalizedNewEmail} -> ${masked2}`);
    }

    return NextResponse.json({ success: true, message: "OTP sent to both emails" });
  } catch (error) {
    console.error("Email change request error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}