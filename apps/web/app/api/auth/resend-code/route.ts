import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@fine-leads/database";
import { getClientIp } from "@fine-leads/utils";
import { sendVerificationOtpEmail } from "@/lib/email";
import { generateOtp, normalizeEmail, otpIdentifiers, storeOtp } from "@/lib/otp";
import { rateLimitOrNull } from "@/lib/rate-limit-response";

const resendCodeSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
});

const GENERIC_OK = { success: true, message: "If the account exists and is unverified, a new code has been sent." };

export async function POST(request: Request) {
  const limited = await rateLimitOrNull(`resend-code:${getClientIp(request)}`, 3, 15 * 60 * 1000);
  if (limited) return limited;

  try {
    const parsed = resendCodeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
    }

    const email = normalizeEmail(parsed.data.email);
    const emailLimited = await rateLimitOrNull(`resend-code:email:${email}`, 3, 15 * 60 * 1000);
    if (emailLimited) return emailLimited;

    const user = await db.user.findUnique({ where: { email }, select: { emailVerified: true } });
    // Same response for unknown / already-verified accounts to avoid account enumeration.
    if (!user || user.emailVerified) {
      return NextResponse.json(GENERIC_OK, { status: 200 });
    }

    const code = generateOtp();
    await storeOtp(otpIdentifiers.signup(email), code);
    await sendVerificationOtpEmail(email, code);

    return NextResponse.json(GENERIC_OK, { status: 200 });
  } catch (error: unknown) {
    console.error("[RESEND_CODE_ERROR]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
