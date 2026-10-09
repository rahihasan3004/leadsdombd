"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut as nextAuthSignOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  Building2,
  UserRoundSearch,
  CreditCard,
  ArrowLeftRight,
  Download,
  ScrollText,
ArrowLeft,
	Shield,
	LogOut,
	MapPin,
	Bot,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@fine-leads/ui";

interface AdminSidebarUser {
  name?: string | null;
  email?: string | null;
}

interface AdminSidebarProps {
  user: AdminSidebarUser;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

const NAV_ITEMS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/admin/agents", label: "Agents Data", icon: UserRoundSearch },
  { href: "/admin/inventory", label: "State Inventory", icon: MapPin },
  { href: "/admin/scraper", label: "Scraper Engine", icon: Bot },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/admin/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/admin/exports", label: "Exports Queue", icon: Download },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
] as const;

export function AdminSidebar({ user, mobileOpen, onMobileOpenChange }: AdminSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  // Close the mobile sheet whenever a link is tapped (the shell layout persists across routes).
  const closeMobile = () => onMobileOpenChange?.(false);

  const initial = user.name?.charAt(0)?.toUpperCase() ?? user.email?.charAt(0)?.toUpperCase() ?? "A";

  const renderNav = () => (
    <>
      <div>
        <Link
          href="/admin"
          onClick={closeMobile}
          className="flex items-center gap-2 px-2 mb-4"
        >
          <Shield className="h-5 w-5 text-surface-950 dark:text-white" />
          <span className="text-xl font-bold tracking-tight text-surface-950 dark:text-white">
            leadsdom
          </span>
        </Link>

        <div className="mx-1 mb-5 p-2.5 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md">
          <span className="text-xs uppercase font-semibold text-amber-600 dark:text-amber-400 block tracking-wider">
            Admin Panel
          </span>
          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
            Full access
          </span>
        </div>

        <nav>
          <span className="text-xs font-bold uppercase tracking-wider text-surface-400 px-2.5 mb-2 block">
            Management
          </span>
          <ul className="flex flex-col space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={closeMobile}
                    className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${
                      active
                        ? "bg-surface-950 text-white dark:bg-white dark:text-surface-950 font-semibold shadow-xs"
                        : "text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-900 hover:text-surface-950 dark:hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4 stroke-[1.5] shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <div className="border-t border-surface-200 dark:border-surface-800 pt-3 mt-auto space-y-1.5">
        <Link
          href="/dashboard"
          onClick={closeMobile}
          className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-900 hover:text-surface-950 dark:hover:text-white rounded-md transition-colors"
        >
          <ArrowLeft className="h-4 w-4 stroke-[1.5]" />
          <span>Back to App</span>
        </Link>

        <div className="flex items-center gap-3 px-2.5 py-2">
          <div className="h-8 w-8 rounded-md bg-amber-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-surface-950 dark:text-white truncate">
              {user.name ?? "Admin"}
            </p>
            <p className="text-xs text-surface-400 truncate">
              {user.email ?? ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => nextAuthSignOut({ callbackUrl: "/login" })}
            aria-label="Log out"
            className="cursor-pointer"
          >
            <LogOut className="h-4 w-4 text-surface-400 hover:text-surface-950 dark:hover:text-white shrink-0" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden lg:flex w-64 h-dvh sticky top-0 bg-white dark:bg-surface-950 border-r border-surface-200 dark:border-surface-800 flex-col justify-between p-4">
        {renderNav()}
      </aside>

      <Dialog open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <DialogContent className="inset-y-0 left-0 top-0 flex h-dvh max-h-dvh w-[85%] max-w-xs translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto overscroll-contain rounded-none border-0 border-r p-0 sm:rounded-none lg:hidden">
          <DialogHeader className="px-6 py-4 border-b border-surface-200 dark:border-surface-800">
            <DialogTitle className="text-base font-semibold text-surface-950 dark:text-white">Menu</DialogTitle>
          </DialogHeader>
          <div className="flex flex-1 flex-col px-4 py-4">
            {renderNav()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}