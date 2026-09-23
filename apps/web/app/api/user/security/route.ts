import { NextResponse } from "next/server";
import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findFirst({
      where: {
        OR: [
          ...(session.user.id ? [{ id: session.user.id }] : []),
          ...(session.user.email ? [{ email: session.user.email }] : []),
        ],
      },
      include: { accounts: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isGoogle =
      user.accounts.some((acc) => acc.provider?.toLowerCase() === "google") ||
      !user.passwordHash ||
      user.passwordHash.length === 0;

    return NextResponse.json({
      hasPassword: Boolean(user.passwordHash && user.passwordHash.length > 0),
      provider: user.accounts[0]?.provider ?? (user.passwordHash ? "credentials" : "google"),
      isGoogleUser: Boolean(isGoogle),
    });
  } catch (error) {
    console.error("Security info fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
