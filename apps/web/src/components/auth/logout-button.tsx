"use client";

import { signOut as nextAuthSignOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => nextAuthSignOut({ callbackUrl: "/login" })}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      Log Out
    </button>
  );
}