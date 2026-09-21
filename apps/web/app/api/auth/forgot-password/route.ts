import { NextResponse } from "next/server";
import { db } from "@fine-leads/database";
import crypto from "crypto";

function generateSecureOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body as { email: string };

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      return NextResponse.json({ success: true });
    }

    await db.verificationToken.deleteMany({
      where: { identifier: normalizedEmail },
    });

    const code = generateSecureOTP();

    if (process.env.NODE_ENV === "development") {
      console.log(`[PASSWORD RESET OTP FOR ${normalizedEmail}]: ${code}`);
    } else {
      const masked = `${code.charAt(0)}***${code.slice(-2)}`;
      console.log(`[PASSWORD_RESET_OTP_DISPATCHED]: ${normalizedEmail} -> ${masked}`);
    }

    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await db.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token: code,
        expires,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}