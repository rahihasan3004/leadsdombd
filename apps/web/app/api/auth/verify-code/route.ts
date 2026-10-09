import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@fine-leads/database";
import { getClientIp } from "@fine-leads/utils";
import { checkOtp, consumeOtp, normalizeEmail, OTP_CODE_REGEX, otpErrorMessage, otpIdentifiers } from "@/lib/otp";
import { rateLimitOrNull } from "@/lib/rate-limit-response";

const verifyCodeSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  code: z.string().trim().regex(OTP_CODE_REGEX, "Verification code must be 6 digits"),
});

export async function POST(request: Request) {
  try {
    const parsed = verifyCodeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
    }

    const email = normalizeEmail(parsed.data.email);
    const limited =
      (await rateLimitOrNull(`verify-code:ip:${getClientIp(request)}`, 20, 15 * 60 * 1000)) ??
      (await rateLimitOrNull(
        `verify-code:${email}`,
        10,
        15 * 60 * 1000,
        "Too many attempts. Please request a new code or try again in 15 minutes."
      ));
    if (limited) return limited;

    const identifier = otpIdentifiers.signup(email);
    const result = await checkOtp(identifier, parsed.data.code);
    if (result !== "ok") {
      return NextResponse.json({ error: otpErrorMessage(result, "verification") }, { status: 400 });
    }

    await db.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { email, emailVerified: null },
        data: { emailVerified: new Date() },
      });
      await consumeOtp(identifier, tx);
    });

    return NextResponse.json({ success: true, message: "Email verified successfully" });
  } catch (error: unknown) {
    console.error("[VERIFY_CODE_ERROR]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
