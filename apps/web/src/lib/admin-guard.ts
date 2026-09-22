import { auth, isAdmin } from "@fine-leads/auth";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

export async function requireAdmin() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const role = (session.user as any).role;

  if (role === "USER") {
    redirect("/dashboard");
  }

  if (!isAdmin(role)) {
    redirect("/dashboard");
  }

  return {
    user: session.user,
    session,
  };
}

export async function requireAdminApi() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any).role;

  if (role === "USER" || !isAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { user: session.user, session };
}