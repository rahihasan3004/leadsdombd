import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@fine-leads/database";
import { checkRateLimit, getClientIp } from "@fine-leads/utils";

const MAX_VERIFY_CODE_ATTEMPTS = 5;
const VERIFY_CODE_WINDOW_MS = 15 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const verifyCodeSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  code: z.string().min(1, "Verification code is required").max(6, "Verification code must be 6 digits"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = verifyCodeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const { email, code } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();
    const enteredCode = code.trim();

    const clientIp = getClientIp(request);
    const rateLimitKey = `verify-code:${normalizedEmail}`;
    const { allowed, remaining, resetAt } = checkRateLimit(rateLimitKey, MAX_VERIFY_CODE_ATTEMPTS, VERIFY_CODE_WINDOW_MS);

    if (!allowed) {
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Too many failed attempts. Please request a new code or try again in 15 minutes." },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        }
      );
    }

    const verificationToken = await db.verificationToken.findFirst({
      where: {
        identifier: normalizedEmail,
        token: enteredCode,
        expires: { gt: new Date() },
        OR: [
          { lockedUntil: null },
          { lockedUntil: { lt: new Date() } },
        ],
      },
    });

    if (!verificationToken) {
      const staleToken = await db.verificationToken.findFirst({
        where: {
          identifier: normalizedEmail,
          token: enteredCode,
          OR: [
            { expires: { lte: new Date() } },
            { lockedUntil: { gte: new Date() } },
          ],
        },
      });

      if (staleToken) {
        await db.verificationToken.update({
          where: { id: staleToken.id },
          data: {
            failedAttempts: staleToken.failedAttempts + 1,
            lockedUntil:
              staleToken.failedAttempts + 1 >= MAX_OTP_ATTEMPTS
                ? new Date(Date.now() + 24 * 60 * 60 * 1000)
                : null,
          },
        });
      }

      return NextResponse.json({ error: "Invalid or expired verification code." }, { status: 400 });
    }

    await db.user.update({
      where: { email: normalizedEmail },
      data: { emailVerified: new Date() },
    });

    await db.verificationToken.deleteMany({
      where: { identifier: normalizedEmail },
    });

    return NextResponse.json({ success: true, message: "Email verified successfully" });
  } catch (error) {
    console.error("Verify code error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
