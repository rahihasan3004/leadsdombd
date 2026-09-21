import { NextResponse } from "next/server";
import { db } from "@fine-leads/database";
import { hashPassword } from "@fine-leads/auth";
import crypto from "crypto";

function generateSecureOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { firstName, lastName, email, password } = body as {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
    };

    if (!firstName || !lastName || !email || !password || password.length < 8) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const name = `${firstName} ${lastName}`;

    const org = await db.organization.create({
      data: { name: name, slug: `org-${crypto.randomUUID().slice(0, 12)}` },
    });

    await db.user.create({
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

    if (process.env.NODE_ENV === "development") {
      console.log(`[REAL OTP FOR ${normalizedEmail}]: ${code}`);
    } else {
      const masked = `${code.charAt(0)}***${code.slice(-2)}`;
      console.log(`[OTP_DISPATCHED]: ${normalizedEmail} -> ${masked}`);
    }

    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await db.verificationToken.deleteMany({
      where: { identifier: normalizedEmail },
    });

    await db.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token: code,
        expires,
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}