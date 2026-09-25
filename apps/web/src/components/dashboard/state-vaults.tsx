"use client";

import { FolderOpen, Download, MapPin, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { LEAD_STATES } from "@fine-leads/utils";

interface StateVault {
  code: string;
  name: string;
  leadCount: number;
  deliverability: number;
}

const VAULTS: StateVault[] = LEAD_STATES.map((s) => ({
  code: s.code,
  name: s.name,
  leadCount: s.count,
  deliverability: 100,
}));

export function StateVaults() {
  return (
    <div className="rounded-xl border-0 bg-slate-50 p-6 dark:bg-slate-900 shadow-none">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          State Lead Vaults
        </h3>
        <Link
          href="/dashboard/lists"
          className="text-xs font-medium text-[#14A800] hover:text-[#108A00] transition-colors"
        >
          View All
        </Link>
      </div>

      <div className="space-y-2">
        {VAULTS.map((vault) => (
          <div
            key={vault.code}
            className="flex items-center justify-between rounded-lg border-0 bg-slate-100 dark:bg-slate-800/30 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#14A800]/10">
                <FolderOpen className="h-4.5 w-4.5 text-[#14A800]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {vault.code}
                  </span>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {vault.name}
                  </p>
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {vault.leadCount} Leads
                  </span>
                  <span className="flex items-center gap-1 text-[#14A800]">
                    <ShieldCheck className="h-3 w-3" />
                    {vault.deliverability}%
                  </span>
                </div>
              </div>
            </div>

            <Link
              href="/dashboard/search"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 shadow-none border-0 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              Unlock
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}