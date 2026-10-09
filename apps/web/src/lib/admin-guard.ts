import { cache } from "react";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "@fine-leads/auth";
import { db } from "@fine-leads/database";

const ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN"]);

export interface AdminUser {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
}

type AdminCheck =
  | { ok: true; user: AdminUser; session: Session }
  | { ok: false; reason: "unauthenticated" | "forbidden" };

/**
 * Resolves the current admin from the session AND the database. The JWT role
 * can be stale (e.g. a demoted admin), so the DB role is authoritative.
 * Cached per request so layout + page share one lookup.
 */
const checkAdmin = cache(async (): Promise<AdminCheck> => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!session || !userId) return { ok: false, reason: "unauthenticated" };

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!user) return { ok: false, reason: "unauthenticated" };
  if (!ADMIN_ROLES.has(user.role)) return { ok: false, reason: "forbidden" };

  return { ok: true, user, session };
});

/** For Server Components (layouts/pages). Redirects non-admins; never returns for them. */
export async function requireAdmin(): Promise<{ user: AdminUser; session: Session }> {
  const result = await checkAdmin();
  if (!result.ok) {
    redirect(result.reason === "unauthenticated" ? "/login?callbackUrl=/admin" : "/dashboard");
  }
  return { user: result.user, session: result.session };
}

/** For Route Handlers. Returns a 401/403 response for non-admins. */
export async function requireAdminApi(): Promise<NextResponse | { user: AdminUser; session: Session }> {
  const result = await checkAdmin();
  if (!result.ok) {
    return result.reason === "unauthenticated"
      ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      : NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }
  return { user: result.user, session: result.session };
}
