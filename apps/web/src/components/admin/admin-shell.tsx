"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";

type AdminShellUser = ComponentProps<typeof AdminSidebar>["user"];

interface AdminShellProps {
  /** Display-only fields, already authorized on the server. */
  user: AdminShellUser;
  children: ReactNode;
}

export function AdminShell({ user, children }: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="h-screen max-h-screen w-full flex overflow-hidden bg-surface-50 dark:bg-surface-950">
      <AdminSidebar user={user} mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <AdminHeader onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
