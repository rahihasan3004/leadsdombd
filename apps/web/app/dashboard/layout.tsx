"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@fine-leads/ui";
import { Menu } from "lucide-react";

const MAX_RETRIES = 20;
let retryCount = 0;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (status === "loading") {
    return (
      <div className="h-screen max-h-screen w-full flex items-center justify-center bg-surface-50 dark:bg-surface-950">
        <div className="text-sm text-neutral-500">Loading...</div>
      </div>
    );
  }

  if (status === "unauthenticated" || !session?.user) {
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      setTimeout(() => router.push("/login"), 0);
    } else {
      retryCount = 0;
      router.push("/login");
    }
    return null;
  }

  const user = {
    name: session.user.name,
    email: session.user.email,
    walletBalance: (session.user as { walletBalance?: number }).walletBalance ?? 25.0,
  };

  return (
    <div className="h-screen max-h-screen w-full flex overflow-hidden bg-surface-50 dark:bg-surface-950">
      <Sidebar user={user} mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b h-14 shrink-0 flex items-center px-4 lg:hidden">
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
        <main className="flex-1 overflow-y-auto bg-slate-100/90 min-h-screen pb-28 sm:pb-8">{children}</main>
      </div>
    </div>
  );
}
