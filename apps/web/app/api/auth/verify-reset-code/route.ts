import { NextResponse } from "next/server";
import { db } from "@fine-leads/database";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, code } = body as { email: string; code: string };

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and code are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const enteredCode = code.trim();

    const verificationToken = await db.verificationToken.findFirst({
      where: {
        identifier: normalizedEmail,
        token: enteredCode,
        expires: { gt: new Date() },
      },
    });

    if (!verificationToken) {
      return NextResponse.json(
        { error: "Invalid or expired verification code." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Verification code is valid.",
    });
  } catch (error) {
    console.error("Verify reset code error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}