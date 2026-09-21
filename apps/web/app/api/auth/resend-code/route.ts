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
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ error: "Email already verified" }, { status: 400 });
    }

    await db.verificationToken.deleteMany({ where: { identifier: normalizedEmail } });

    const code = generateSecureOTP();

    if (process.env.NODE_ENV === "development") {
      console.log(`[REAL OTP FOR ${normalizedEmail}]: ${code}`);
    } else {
      const masked = `${code.charAt(0)}***${code.slice(-2)}`;
      console.log(`[OTP_DISPATCHED]: ${normalizedEmail} -> ${masked}`);
    }

    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await db.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token: code,
        expires,
      },
    });

    return NextResponse.json(
      { success: true, message: "Verification code resent successfully." },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("Resend code error:", error);

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P1017"
    ) {
      return NextResponse.json(
        { error: "Database connection lost. Please try again." },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}