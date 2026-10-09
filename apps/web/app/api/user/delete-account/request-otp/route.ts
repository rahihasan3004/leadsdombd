import { NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";
import { checkRateLimit } from "@fine-leads/utils/rate-limit";
import { sendAccountDeletionOtpEmail } from "@/lib/email";
import { generateOtp, otpIdentifiers, storeOtp } from "@/lib/otp";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const body = (await request.json().catch(() => ({}))) as { confirmText?: unknown };
    if (body.confirmText !== "DELETE") {
      return NextResponse.json({ error: "Confirmation text must be DELETE" }, { status: 400 });
    }

    const { allowed } = await checkRateLimit(`delete-account-otp:${userId}`, 3, 15 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests. Please try again in 15 minutes." }, { status: 429 });
    }

    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const identifier = otpIdentifiers.deleteAccount(userId);
    const otp = generateOtp();
    await storeOtp(identifier, otp);

    const result = await sendAccountDeletionOtpEmail(user.email, otp);
    if ("error" in result && result.error) {
      await db.verificationToken.deleteMany({ where: { identifier } });
      return NextResponse.json({ error: "We couldn't send the deletion code. Please try again." }, { status: 502 });
    }

    return NextResponse.json({ success: true, message: "Deletion confirmation code sent to your email" });
  } catch (error) {
    console.error("Delete account OTP request error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
