import { NextResponse } from "next/server";
import { db } from "@fine-leads/database";

const failedAttemptsMap = new Map<string, { count: number; firstAttempt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function checkRateLimit(key: string): { allowed: boolean; remainingAttempts: number } {
  const now = Date.now();
  const record = failedAttemptsMap.get(key);

  if (!record || now - record.firstAttempt > WINDOW_MS) {
    failedAttemptsMap.set(key, { count: 0, firstAttempt: now });
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }

  if (record.count >= MAX_ATTEMPTS) {
    return { allowed: false, remainingAttempts: 0 };
  }

  return { allowed: true, remainingAttempts: MAX_ATTEMPTS - record.count };
}

function recordFailedAttempt(key: string) {
  const record = failedAttemptsMap.get(key);
  if (record) {
    record.count += 1;
  }
}

function clearRateLimit(key: string) {
  failedAttemptsMap.delete(key);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, code } = body as { email: string; code: string };

    if (!email || !code) {
      return NextResponse.json({ error: "Email and code are required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const enteredCode = code.trim();

    const rateLimitKey = `verify:${normalizedEmail}`;
    const { allowed, remainingAttempts } = checkRateLimit(rateLimitKey);

    if (!allowed) {
      return NextResponse.json(
        { error: "Too many failed attempts. Please request a new code or try again in 15 minutes." },
        {
          status: 429,
          headers: { "Retry-After": "900" },
        }
      );
    }

    const verificationToken = await db.verificationToken.findFirst({
      where: {
        identifier: normalizedEmail,
        token: enteredCode,
        expires: { gt: new Date() },
      },
    });

    if (!verificationToken) {
      recordFailedAttempt(rateLimitKey);
      return NextResponse.json({ error: "Invalid or expired verification code." }, { status: 400 });
    }

    clearRateLimit(rateLimitKey);

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