import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@fine-leads/database";
import { checkRateLimit, getClientIp } from "@fine-leads/utils";
import crypto from "crypto";

const MAX_FORGOT_PASSWORD_ATTEMPTS = 5;
const FORGOT_PASSWORD_WINDOW_MS = 15 * 60 * 1000;

const forgotPasswordSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
});

function generateSecureOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

function hashOTP(otp: string, identifier: string): string {
  return crypto.createHmac("sha256", identifier).update(otp).digest("hex");
}

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateLimitKey = `forgot-password:${clientIp}`;
    const { allowed, remaining, resetAt } = checkRateLimit(rateLimitKey, MAX_FORGOT_PASSWORD_ATTEMPTS, FORGOT_PASSWORD_WINDOW_MS);

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
    const parsed = forgotPasswordSchema.safeParse(body);

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
      return NextResponse.json({ success: true });
    }

    await db.verificationToken.deleteMany({
      where: { identifier: normalizedEmail },
    });

    const code = generateSecureOTP();
    const hashedCode = hashOTP(code, normalizedEmail);
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await db.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token: hashedCode,
        expires,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
