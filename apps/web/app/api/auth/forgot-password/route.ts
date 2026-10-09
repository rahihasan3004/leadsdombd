import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@fine-leads/database";
import { getClientIp } from "@fine-leads/utils";
import { sendPasswordResetOtpEmail } from "@/lib/email";
import { generateOtp, normalizeEmail, otpIdentifiers, storeOtp } from "@/lib/otp";
import { rateLimitOrNull } from "@/lib/rate-limit-response";

const forgotPasswordSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
});

export async function POST(request: Request) {
  const limited = rateLimitOrNull(`forgot-password:${getClientIp(request)}`, 5, 15 * 60 * 1000);
  if (limited) return limited;

  try {
    const parsed = forgotPasswordSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
    }

    const email = normalizeEmail(parsed.data.email);
    const emailLimited = rateLimitOrNull(`forgot-password:email:${email}`, 3, 15 * 60 * 1000);
    if (emailLimited) return emailLimited;

    const user = await db.user.findUnique({ where: { email }, select: { id: true } });
    // Always respond the same way so the endpoint can't be used to enumerate accounts.
    if (user) {
      const code = generateOtp();
      await storeOtp(otpIdentifiers.passwordReset(email), code);
      await sendPasswordResetOtpEmail(email, code);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[FORGOT_PASSWORD_ERROR]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
