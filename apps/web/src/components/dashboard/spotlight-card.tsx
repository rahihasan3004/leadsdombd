"use client";

import { ArrowRight, TrendingUp } from "lucide-react";
import Link from "next/link";

export function SpotlightCard() {
  return (
    <div className="rounded-xl border-0 bg-slate-50 p-6 dark:bg-slate-900 shadow-none">
      <div className="mb-3 inline-flex items-center gap-2 rounded-lg bg-[#14A800]/10 px-2.5 py-1 text-xs font-semibold text-[#14A800]">
        <TrendingUp className="h-3.5 w-3.5" />
        Market Spotlight
      </div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
        Texas is your next high-yield wealth market.
      </h3>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
        200 verified luxury brokers and Realtors ready in Austin, Dallas, and Houston. Zero-bounce delivery with premium agent intelligence.
      </p>
      <Link
        href="/dashboard/search?state=TX"
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#14A800] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#108A00] transition-colors shadow-none"
      >
        Run Agent Discovery
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}