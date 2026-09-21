import { NextResponse } from "next/server";
import { db } from "@fine-leads/database";
import { hashPassword } from "@fine-leads/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, code, newPassword } = body as {
      email: string;
      code: string;
      newPassword: string;
    };

    if (!email || !code || !newPassword) {
      return NextResponse.json(
        { error: "Email, code, and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
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

    const passwordHash = await hashPassword(newPassword);

    await db.user.update({
      where: { email: normalizedEmail },
      data: { passwordHash },
    });

    await db.verificationToken.deleteMany({
      where: { identifier: normalizedEmail },
    });

    return NextResponse.json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}