import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@fine-leads/database";
import { hashPassword } from "@fine-leads/auth";
import { getClientIp } from "@fine-leads/utils";
import {
  withVerifiedOtps,
  normalizeEmail,
  OTP_CODE_REGEX,
  otpErrorMessage,
  otpIdentifiers,
} from "@/lib/otp";
import { rateLimitOrNull } from "@/lib/rate-limit-response";

const resetPasswordSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  code: z
    .string()
    .trim()
    .regex(OTP_CODE_REGEX, "Verification code must be 6 digits"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be 128 characters or fewer"),
});

export async function POST(request: Request) {
  const limited = await rateLimitOrNull(
    `reset-password:${getClientIp(request)}`,
    5,
    15 * 60 * 1000,
  );
  if (limited) return limited;

  try {
    const parsed = resetPasswordSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 },
      );
    }

    const email = normalizeEmail(parsed.data.email);
    const identifier = otpIdentifiers.passwordReset(email);

    const passwordHash = await hashPassword(parsed.data.newPassword);

    const checked = await withVerifiedOtps(
      [{ identifier, code: parsed.data.code, label: "verification" }],
      async (tx) => {
        // Receiving the code proves inbox ownership, so the email counts as verified too.
        const now = new Date();
        await tx.user.updateMany({
          where: { email },
          data: { passwordHash, tokenVersion: { increment: 1 } },
        });
        await tx.user.updateMany({
          where: { email, emailVerified: null },
          data: { emailVerified: now },
        });
      },
    );

    if (checked.result !== "ok")
      return NextResponse.json(
        { error: otpErrorMessage(checked.result, "verification") },
        { status: 400 },
      );

    return NextResponse.json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error: unknown) {
    console.error("[RESET_PASSWORD_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
