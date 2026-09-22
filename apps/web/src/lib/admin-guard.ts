import { auth } from "@fine-leads/auth";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

export interface AdminUser {
  id: string;
  email?: string | null;
  name?: string | null;
  role: string;
  walletBalance?: number;
  organizationId?: string | null;
}

export async function requireAdmin() {
  const session = await auth();
  const user = session?.user as AdminUser | undefined;

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  return { user, session };
}

export async function requireAdminApi(): Promise<
  NextResponse | { user: AdminUser; session: any }
> {
  const session = await auth();
  const user = session?.user as AdminUser | undefined;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Forbidden: Admin access required" },
      { status: 403 }
    );
  }

  return { user, session };
}