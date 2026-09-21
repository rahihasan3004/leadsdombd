import { NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { otp } = body as { otp: string };

    if (!otp || otp.length !== 6) {
      return NextResponse.json({ error: "A valid 6-digit OTP is required" }, { status: 400 });
    }

    const email = session.user.email;
    const userId = session.user.id;

    const verificationToken = await db.verificationToken.findFirst({
      where: {
        identifier: email,
        token: otp,
        expires: { gt: new Date() },
      },
    });

    if (!verificationToken) {
      return NextResponse.json({ error: "Invalid or expired OTP code" }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, organizationId: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await db.$transaction(async (tx) => {
      if (user.email) {
        await tx.verificationToken.deleteMany({
          where: { identifier: user.email },
        });
      }

      await tx.walletTransaction.deleteMany({ where: { userId: user.id } });
      await tx.leadPurchase.deleteMany({ where: { userId: user.id } });

      if (user.organizationId) {
        const remainingOrgMembers = await tx.user.count({
          where: {
            organizationId: user.organizationId,
            id: { not: user.id },
          },
        });
        if (remainingOrgMembers === 0) {
          await tx.organization.delete({ where: { id: user.organizationId } }).catch(() => {});
        }
      }

      await tx.user.delete({ where: { id: user.id } });
    });

    return NextResponse.json({ success: true, message: "Account permanently deleted" });
  } catch (error) {
    console.error("Delete account error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}