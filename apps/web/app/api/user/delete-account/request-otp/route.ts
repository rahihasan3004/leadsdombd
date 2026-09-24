import { NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";
import crypto from "crypto";

function generateSecureOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

function hashOTP(otp: string, identifier: string): string {
  return crypto.createHmac("sha256", identifier).update(otp).digest("hex");
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // body is optional for backward compat
    }

    if (body.confirmText !== "DELETE") {
      return NextResponse.json({ error: "Confirmation text must be DELETE" }, { status: 400 });
    }

    const email = session.user.email;
    const otp = generateSecureOTP();
    const hashedOtp = hashOTP(otp, email);
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await db.verificationToken.deleteMany({ where: { identifier: email } });

    await db.verificationToken.create({
      data: { identifier: email, token: hashedOtp, expires },
    });

    return NextResponse.json({ success: true, message: "Deletion confirmation code sent to your email" });
  } catch (error) {
    console.error("Delete account OTP request error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}