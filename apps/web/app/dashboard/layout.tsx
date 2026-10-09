"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@fine-leads/ui";
import { BrandedLoader } from "@/components/ui/branded-loader";
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
  const pathname = usePathname();
  // Leads Vault is flat white on phones (incl. the main padding around it); slate canvas from md up.
  const whiteOnMobile = pathname?.startsWith("/dashboard/lists") ?? false;

  if (status === "loading") {
    return <BrandedLoader />;
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
    <div data-dashboard-shell className="h-dvh max-h-dvh min-h-0 w-full flex overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Sidebar user={user} mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />
      <div className="flex-1 flex flex-col h-full min-h-0 min-w-0 overflow-hidden">
        {/* Mobile header: fixed to the viewport, outside the scroll container, so nothing can scroll it away. */}
        <header className="fixed top-0 left-0 right-0 w-full h-14 z-[80] bg-white/95 backdrop-blur-md border-b border-slate-200/80 flex items-center px-4 lg:hidden">
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
        <main
          data-dashboard-scroll
          tabIndex={0}
          aria-label="Dashboard content"
          className={`relative h-full min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain pt-14 lg:pt-0 ${
            whiteOnMobile ? "bg-white md:bg-slate-50" : "bg-slate-50"
          }`}
        >
          <div className="min-h-full px-4 pt-4 pb-12 md:px-8 md:pt-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
