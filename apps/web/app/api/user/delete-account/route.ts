import { NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";
import { getClientIp } from "@fine-leads/utils";
import { withVerifiedOtps, otpErrorMessage, otpIdentifiers } from "@/lib/otp";

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const body = (await request.json().catch(() => ({}))) as {
      otp?: unknown;
      confirmText?: unknown;
    };
    if (body.confirmText !== "DELETE") {
      return NextResponse.json(
        { error: "Confirmation text must be DELETE" },
        { status: 400 },
      );
    }
    if (typeof body.otp !== "string" || !/^\d{6}$/.test(body.otp)) {
      return NextResponse.json(
        { error: "A valid 6-digit OTP is required" },
        { status: 400 },
      );
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, organizationId: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const identifier = otpIdentifiers.deleteAccount(userId);
    const checked = await withVerifiedOtps(
      [{ identifier, code: body.otp, label: "deletion" }],
      async (tx) => {
        // Verification codes are keyed by email or by user id, not by relation, so clean them up explicitly.
        await tx.verificationToken.deleteMany({
          where: {
            OR: [
              { identifier: user.email },
              { identifier: { startsWith: `email-change:current:${user.id}` } },
              { identifier: { startsWith: `email-change:new:${user.id}:` } },
              { identifier },
            ],
          },
        });
        await tx.auditLog.deleteMany({ where: { userId: user.id } });

        // Accounts, sessions, subscriptions, API keys, search history, saved lists, exports,
        // purchases (+ unlocked leads) and wallet transactions all cascade from User (onDelete: Cascade).
        await tx.user.delete({ where: { id: user.id } });

        // Keep a minimal, non-identifying record that a deletion happened.
        await tx.auditLog.create({
          data: {
            userId: null,
            action: "delete_account",
            resource: "user",
            resourceId: user.id,
            ipAddress: getClientIp(request),
            userAgent: request.headers.get("user-agent") ?? undefined,
          },
        });
      },
    );

    if (checked.result !== "ok")
      return NextResponse.json(
        { error: otpErrorMessage(checked.result, "deletion") },
        { status: 400 },
      );

    // Remove the user's organization if they were its last member. Done outside the transaction:
    // a failed statement inside a Postgres transaction aborts it, which previously broke deletion.
    if (user.organizationId) {
      try {
        const remaining = await db.user.count({
          where: { organizationId: user.organizationId },
        });
        if (remaining === 0) {
          await db.organization.delete({ where: { id: user.organizationId } });
        }
      } catch (orgErr) {
        console.warn("Org cleanup after account deletion failed:", orgErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Account permanently deleted",
    });
  } catch (error) {
    console.error("Delete account error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
