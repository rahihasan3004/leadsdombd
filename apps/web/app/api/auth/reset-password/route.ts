import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@fine-leads/database";
import { hashPassword, checkRateLimit, getClientIp } from "@fine-leads/utils";

const MAX_RESET_PASSWORD_ATTEMPTS = 5;
const RESET_PASSWORD_WINDOW_MS = 15 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const resetPasswordSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  code: z.string().min(1, "Verification code is required").max(6, "Verification code must be 6 digits"),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(128, "Password must be 128 characters or fewer"),
});

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateLimitKey = `reset-password:${clientIp}`;
    const { allowed, remaining, resetAt } = checkRateLimit(rateLimitKey, MAX_RESET_PASSWORD_ATTEMPTS, RESET_PASSWORD_WINDOW_MS);

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
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const { email, code, newPassword } = parsed.data;
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

    const passwordHash = await hashPassword(newPassword);

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { email: normalizedEmail },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 },
        },
      });

      await tx.verificationToken.deleteMany({
        where: { identifier: normalizedEmail },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
