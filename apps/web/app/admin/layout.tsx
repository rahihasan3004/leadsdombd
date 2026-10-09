import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/admin-guard";
import { AdminShell } from "@/components/admin/admin-shell";

// Always evaluate the guard per request; never serve a cached admin shell.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Server-side: redirects to /login or /dashboard before any admin UI is rendered.
  const { user } = await requireAdmin();

  return <AdminShell user={{ name: user.name, email: user.email }}>{children}</AdminShell>;
}
