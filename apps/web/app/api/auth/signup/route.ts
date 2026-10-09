import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@fine-leads/database";
import { hashPassword } from "@fine-leads/auth";
import { getClientIp } from "@fine-leads/utils";
import { sendVerificationOtpEmail } from "@/lib/email";
import { generateOtp, normalizeEmail, otpIdentifiers, storeOtp } from "@/lib/otp";
import { rateLimitOrNull } from "@/lib/rate-limit-response";

const signupSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(50, "First name must be 50 characters or fewer"),
  lastName: z.string().trim().min(1, "Last name is required").max(50, "Last name must be 50 characters or fewer"),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password must be 128 characters or fewer"),
});

export async function POST(request: Request) {
  const limited = rateLimitOrNull(
    `signup:${getClientIp(request)}`,
    5,
    15 * 60 * 1000,
    "Too many signup attempts. Please try again later."
  );
  if (limited) return limited;

  try {
    const parsed = signupSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
    }

    const { firstName, lastName, password } = parsed.data;
    const email = normalizeEmail(parsed.data.email);

    const existingUser = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const name = `${firstName} ${lastName}`;
    const code = generateOtp();

    await db.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name, slug: `org-${crypto.randomUUID().slice(0, 12)}` },
      });

      await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          emailVerified: null,
          role: "USER",
          walletBalance: "0.00",
          credits: 0,
          tokenVersion: 0,
          organizationId: org.id,
          subscriptions: {
            create: { organizationId: org.id, tier: "FREE", status: "ACTIVE" },
          },
        },
      });

      await storeOtp(otpIdentifiers.signup(email), code, tx);
    });

    // Send after commit; if delivery fails the user can request a new code from /verify-email.
    let emailSent = true;
    try {
      await sendVerificationOtpEmail(email, code);
    } catch (err) {
      emailSent = false;
      console.error("[SIGNUP_EMAIL_FAILED]:", err);
    }

    return NextResponse.json({ success: true, emailSent }, { status: 201 });
  } catch (error: unknown) {
    console.error("[SIGNUP_ERROR]:", error);
    return NextResponse.json({ error: "Unable to create account. Please try again." }, { status: 500 });
  }
}
