import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@fine-leads/auth";
import { db, Prisma } from "@fine-leads/database";
import { getClientIp } from "@fine-leads/utils";
import { withVerifiedOtps, otpErrorMessage, otpIdentifiers } from "@/lib/otp";

const schema = z.object({
  newEmail: z.string().trim().toLowerCase().email(),
  currentEmailCode: z.string().regex(/^\d{6}$/),
  newEmailCode: z.string().regex(/^\d{6}$/),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter both 6-digit codes" },
        { status: 400 },
      );
    }
    const { newEmail, currentEmailCode, newEmailCode } = parsed.data;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentId = otpIdentifiers.emailChangeCurrent(userId);
    const newId = otpIdentifiers.emailChangeNew(userId, newEmail);

    try {
      const checked = await withVerifiedOtps(
        [
          {
            identifier: currentId,
            code: currentEmailCode,
            label: "current email",
          },
          { identifier: newId, code: newEmailCode, label: "new email" },
        ],
        async (tx) => {
          await tx.user.update({
            where: { id: userId },
            data: { email: newEmail, emailVerified: new Date() },
          });
          await tx.auditLog.create({
            data: {
              userId,
              action: "change_email",
              resource: "user",
              resourceId: userId,
              details: { from: user.email, to: newEmail },
              ipAddress: getClientIp(request),
              userAgent: request.headers.get("user-agent") ?? undefined,
            },
          });
        },
      );
      if (checked.result !== "ok")
        return NextResponse.json(
          { error: otpErrorMessage(checked.result, checked.label ?? "email") },
          { status: 400 },
        );
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return NextResponse.json(
          { error: "Email is already in use by another account" },
          { status: 409 },
        );
      }
      throw err;
    }

    return NextResponse.json({
      success: true,
      message: "Email updated successfully",
      email: newEmail,
    });
  } catch (error) {
    console.error("Email verify change error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
