"use client";

import { useState } from "react";
import { auth } from "@fine-leads/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@fine-leads/ui";
import { Menu } from "lucide-react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [mobileOpen, setMobileOpen] = useState(false);

  const user = {
    name: session.user.name,
    email: session.user.email,
    walletBalance: (session.user as { walletBalance?: number }).walletBalance ?? 25.0,
  };

  return (
    <div className="h-screen max-h-screen w-full flex overflow-hidden bg-surface-50 dark:bg-surface-950">
      <Sidebar user={user} mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <header className="h-14 shrink-0 border-b border-neutral-200 bg-white flex items-center px-4 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="ml-3 font-semibold text-sm text-neutral-900">Dashboard</span>
        </header>
        <main className="flex-1 flex flex-col overflow-hidden w-full">{children}</main>
      </div>
    </div>
  );
}
