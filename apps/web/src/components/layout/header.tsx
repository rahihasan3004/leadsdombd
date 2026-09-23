"use client";

import { Logo } from "@/components/logo";

interface HeaderUser {
  name?: string | null;
  email?: string | null;
}

interface HeaderProps {
  user: HeaderUser;
}

export function DashboardHeader({ user }: HeaderProps) {
  return (
    <header className="h-14 shrink-0 border-b border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-950 px-6 flex items-center justify-between">
      <Logo size={28} />
      <h1 className="text-lg font-semibold text-surface-950 dark:text-white">
        Dashboard
      </h1>
    </header>
  );
}