import { NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { newEmail, currentEmailCode, newEmailCode } = body as {
      newEmail: string;
      currentEmailCode: string;
      newEmailCode: string;
    };

    if (!newEmail || !currentEmailCode || !newEmailCode) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    const normalizedNewEmail = newEmail.toLowerCase().trim();
    const currentEmail = session.user.email;

    const currentEmailToken = await db.verificationToken.findFirst({
      where: {
        identifier: currentEmail,
        token: currentEmailCode,
        expires: { gt: new Date() },
      },
    });

    if (!currentEmailToken) {
      return NextResponse.json({ error: "Invalid or expired verification code for current email" }, { status: 400 });
    }

    const newEmailToken = await db.verificationToken.findFirst({
      where: {
        identifier: normalizedNewEmail,
        token: newEmailCode,
        expires: { gt: new Date() },
      },
    });

    if (!newEmailToken) {
      return NextResponse.json({ error: "Invalid or expired verification code for new email" }, { status: 400 });
    }

    const existingUser = await db.user.findUnique({ where: { email: normalizedNewEmail } });
    if (existingUser && existingUser.id !== session.user.id) {
      return NextResponse.json({ error: "Email is already in use by another account" }, { status: 409 });
    }

    await db.user.update({
      where: { id: session.user.id },
      data: { email: normalizedNewEmail, emailVerified: new Date() },
    });

    await db.verificationToken.deleteMany({ where: { identifier: currentEmail } });
    await db.verificationToken.deleteMany({ where: { identifier: normalizedNewEmail } });

    return NextResponse.json({ success: true, message: "Email updated successfully" });
  } catch (error) {
    console.error("Email verify change error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}