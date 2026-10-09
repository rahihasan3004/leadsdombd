import { NextResponse } from "next/server";
import { z } from "zod";
import { getClientIp } from "@fine-leads/utils";
import { checkOtp, normalizeEmail, OTP_CODE_REGEX, otpErrorMessage, otpIdentifiers } from "@/lib/otp";
import { rateLimitOrNull } from "@/lib/rate-limit-response";

const verifyResetCodeSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  code: z.string().trim().regex(OTP_CODE_REGEX, "Verification code must be 6 digits"),
});

/** Pre-checks a reset code (UI step). Counts failed attempts; the code is consumed only by reset-password. */
export async function POST(request: Request) {
  const limited = await rateLimitOrNull(`verify-reset-code:${getClientIp(request)}`, 10, 15 * 60 * 1000);
  if (limited) return limited;

  try {
    const parsed = verifyResetCodeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
    }

    const result = await checkOtp(otpIdentifiers.passwordReset(normalizeEmail(parsed.data.email)), parsed.data.code);
    if (result !== "ok") {
      return NextResponse.json({ error: otpErrorMessage(result, "verification") }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Verification code is valid." });
  } catch (error: unknown) {
    console.error("[VERIFY_RESET_CODE_ERROR]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
