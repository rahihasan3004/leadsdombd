import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@fine-leads/database";
import { checkRateLimit, getClientIp } from "@fine-leads/utils";
import crypto from "crypto";

const MAX_RESEND_CODE_ATTEMPTS = 3;
const RESEND_CODE_WINDOW_MS = 15 * 60 * 1000;

const resendCodeSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
});

function generateSecureOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateLimitKey = `resend-code:${clientIp}`;
    const { allowed, remaining, resetAt } = checkRateLimit(rateLimitKey, MAX_RESEND_CODE_ATTEMPTS, RESEND_CODE_WINDOW_MS);

    if (!allowed) {
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        }
      );
    }

    const body = await request.json();
    const parsed = resendCodeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const { email } = parsed.data;
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
