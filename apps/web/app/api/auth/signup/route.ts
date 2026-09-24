import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@fine-leads/database";
import { hashPassword } from "@fine-leads/auth";
import { checkRateLimit, getClientIp } from "@fine-leads/utils";
import { sendVerificationOtpEmail } from "@/lib/email";
import crypto from "crypto";

const MAX_SIGNUP_ATTEMPTS = 5;
const SIGNUP_WINDOW_MS = 15 * 60 * 1000;

const signupSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50, "First name must be 50 characters or fewer"),
  lastName: z.string().min(1, "Last name is required").max(50, "Last name must be 50 characters or fewer"),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password must be 128 characters or fewer"),
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
    const rateLimitKey = `signup:${clientIp}`;
    const { allowed, remaining, resetAt } = checkRateLimit(rateLimitKey, MAX_SIGNUP_ATTEMPTS, SIGNUP_WINDOW_MS);

    if (!allowed) {
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Too many signup attempts. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        }
      );
    }

    const body = await request.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const { firstName, lastName, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const name = `${firstName} ${lastName}`;

    const result = await db.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: name, slug: `org-${crypto.randomUUID().slice(0, 12)}` },
      });

      const user = await tx.user.create({
        data: {
          name,
          email: normalizedEmail,
          passwordHash,
          organizationId: org.id,
          subscriptions: {
            create: {
              organizationId: org.id,
              tier: "FREE",
              status: "ACTIVE",
            },
          },
        },
      });

      const code = generateSecureOTP();
      await sendVerificationOtpEmail(normalizedEmail, code);
      const hashedCode = hashOTP(code, normalizedEmail);
      const expires = new Date(Date.now() + 15 * 60 * 1000);

      await tx.verificationToken.deleteMany({
        where: { identifier: normalizedEmail },
      });

      await tx.verificationToken.create({
        data: {
          identifier: normalizedEmail,
          token: hashedCode,
          expires,
        },
      });

      return user;
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
