"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut as nextAuthSignOut } from "next-auth/react";
import {
  LayoutGrid,
  Search,
  Database,
  CreditCard,
  HelpCircle,
  Settings,
  LogOut,
  X,
} from "lucide-react";
import { Logo } from "@/components/logo";

interface SidebarUser {
  name?: string | null;
  email?: string | null;
}

interface SidebarProps {
  user: SidebarUser;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/dashboard/search", label: "Search Leads", icon: Search },
  { href: "/dashboard/lists", label: "My Leads Vault", icon: Database },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/support", label: "Support", icon: HelpCircle },
] as const;

export function Sidebar({ user, mobileOpen, onMobileOpenChange }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const initial =
    user.name?.charAt(0)?.toUpperCase() ??
    user.email?.charAt(0)?.toUpperCase() ??
    "U";

  const closeMobile = () => onMobileOpenChange?.(false);

  return (
    <>
      <aside className="hidden lg:flex w-64 h-screen sticky top-0 bg-white border-r border-neutral-200 flex-col justify-between">
        <div>
          <div className="px-6 py-6 flex items-center gap-3">
            <Logo size={36} showText={true} />
          </div>

          <nav className="px-3">
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase px-3 mb-3 block">
              Main Pipeline
            </span>
            <ul className="flex flex-col space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={closeMobile}
                      className={`flex items-center gap-3.5 px-4 py-3 text-sm rounded-xl transition-all duration-150 ${
                        active
                          ? "bg-[#F0F4FF] text-[#465FFF] font-semibold shadow-none"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 hover:translate-x-1"
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 shrink-0 ${
                          active ? "text-[#465FFF]" : "text-slate-400"
                        }`}
                      />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className="border-t border-slate-100 p-4 space-y-2">
          <Link
            href="/dashboard/settings"
            onClick={closeMobile}
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors"
          >
            <Settings className="h-5 w-5 shrink-0 text-slate-400" />
            <span>Settings</span>
          </Link>

          <div className="flex items-center gap-3 px-4 py-2">
            <div className="h-9 w-9 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center text-xs shrink-0">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {user.name ?? "User"}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {user.email ?? ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                closeMobile();
                nextAuthSignOut({ callbackUrl: "/login" });
              }}
              className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4 shrink-0" />
            </button>
          </div>
        </div>
      </aside>

      <div
        className={`fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] transition-opacity ${
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={closeMobile}
      />

      <div
        className={`fixed inset-y-0 left-0 w-[85%] max-w-xs bg-white shadow-2xl z-[70] p-6 flex flex-col justify-between border-r border-slate-200 h-[100dvh] overflow-y-auto transform transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          <div className="flex items-center justify-between mb-6">
            <Logo size={36} showText={true} />
            <button
              type="button"
              onClick={closeMobile}
              className="text-slate-400 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-50 transition-colors"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="px-3">
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase px-3 mb-3 block">
              Main Pipeline
            </span>
            <ul className="flex flex-col space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={closeMobile}
                      className={`flex items-center gap-3.5 px-4 py-3 text-sm rounded-xl transition-all duration-150 ${
                        active
                          ? "bg-[#F0F4FF] text-[#465FFF] font-semibold shadow-none"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 hover:translate-x-1"
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 shrink-0 ${
                          active ? "text-[#465FFF]" : "text-slate-400"
                        }`}
                      />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className="border-t border-slate-100 p-4 space-y-2">
          <Link
            href="/dashboard/settings"
            onClick={closeMobile}
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors"
          >
            <Settings className="h-5 w-5 shrink-0 text-slate-400" />
            <span>Settings</span>
          </Link>

          <div className="flex items-center gap-3 px-4 py-2">
            <div className="h-9 w-9 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center text-xs shrink-0">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {user.name ?? "User"}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {user.email ?? ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                closeMobile();
                nextAuthSignOut({ callbackUrl: "/login" });
              }}
              className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4 shrink-0" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
