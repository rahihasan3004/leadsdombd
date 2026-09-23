import { NextResponse } from "next/server";
import { db } from "@fine-leads/database";
import { checkRateLimit, getClientIp } from "@fine-leads/utils";

const MAX_VERIFY_RESET_CODE_ATTEMPTS = 5;
const VERIFY_RESET_CODE_WINDOW_MS = 15 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateLimitKey = `verify-reset-code:${clientIp}`;
    const { allowed, remaining, resetAt } = checkRateLimit(rateLimitKey, MAX_VERIFY_RESET_CODE_ATTEMPTS, VERIFY_RESET_CODE_WINDOW_MS);

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
    const { email, code } = body as { email: string; code: string };

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and code are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const enteredCode = code.trim();

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

      return NextResponse.json(
        { error: "Invalid or expired verification code." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Verification code is valid.",
    });
  } catch (error) {
    console.error("Verify reset code error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
