"use client";

import { usePathname } from "next/navigation";
import { Button } from "@fine-leads/ui";
import { Menu } from "lucide-react";

interface AdminHeaderProps {
  onMenuClick?: () => void;
}

const PAGE_TITLES: Record<string, string> = {
  "/admin": "Overview",
  "/admin/users": "Users",
  "/admin/organizations": "Organizations",
  "/admin/agents": "Agents Data",
  "/admin/inventory": "State Inventory",
  "/admin/scraper": "Scraper Engine",
  "/admin/subscriptions": "Subscriptions",
  "/admin/transactions": "Transactions",
  "/admin/exports": "Exports Queue",
  "/admin/audit-logs": "Audit Logs",
};

export function AdminHeader({ onMenuClick }: AdminHeaderProps) {
  const pathname = usePathname();
  const title = Object.entries(PAGE_TITLES).find(([key]) => {
    if (key === "/admin") return pathname === "/admin";
    return pathname.startsWith(key);
  })?.[1] ?? "Admin Panel";

  return (
    <header className="h-14 shrink-0 border-b border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-950 px-4 lg:px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold text-surface-950 dark:text-white">
            {title}
          </h1>
        </div>
      </div>
    </header>
  );
}