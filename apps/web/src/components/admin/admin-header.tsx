"use client";

import { usePathname } from "next/navigation";

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

export function AdminHeader() {
  const pathname = usePathname();
  const title = Object.entries(PAGE_TITLES).find(([key]) => {
    if (key === "/admin") return pathname === "/admin";
    return pathname.startsWith(key);
  })?.[1] ?? "Admin Panel";

  return (
    <header className="h-14 shrink-0 border-b border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-950 px-6 flex items-center justify-between">
      <div>
        <h1 className="text-lg font-semibold text-surface-950 dark:text-white">
          {title}
        </h1>
      </div>
    </header>
  );
}