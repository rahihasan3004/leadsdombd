"use client";

import { useState, useMemo } from "react";
import { TrendingUp, Users, FileSearch, ShieldCheck } from "lucide-react";
import { Skeleton } from "@fine-leads/ui";

export interface ActivityEvent {
  id: string;
  type: "verified" | "exported" | "searched" | "unlocked";
  description: string;
  time: string;
  state?: string;
}

const PERIODS = ["7D", "30D", "90D"] as const;

const typeConfig: Record<string, { bg: string }> = {
  verified: { bg: "bg-[#14A800]/10" },
  exported: { bg: "bg-blue-50 dark:bg-blue-500/10" },
  searched: { bg: "bg-amber-50 dark:bg-amber-500/10" },
  unlocked: { bg: "bg-purple-50 dark:bg-purple-500/10" },
};

function EventIcon({ type }: { type: string }) {
  const cls = "h-3.5 w-3.5";
  switch (type) {
    case "verified":
      return <ShieldCheck className={`${cls} text-[#14A800]`} />;
    case "exported":
      return <FileSearch className={`${cls} text-blue-600`} />;
    case "searched":
      return <TrendingUp className={`${cls} text-amber-600`} />;
    case "unlocked":
      return <Users className={`${cls} text-purple-600`} />;
    default:
      return <FileSearch className={`${cls} text-slate-400`} />;
  }
}

interface ActivityFeedProps {
  events?: ActivityEvent[];
  trendData?: number[];
  loading?: boolean;
}

export function ActivityFeed({ events = [], trendData = [], loading = false }: ActivityFeedProps) {
  const [period, setPeriod] = useState<string>("30D");

  if (loading) {
    return (
      <div className="rounded-xl border-0 bg-slate-50 p-6 dark:bg-slate-900 shadow-none">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <Skeleton className="h-28 w-full mb-4" />
        <Skeleton className="h-4 w-32 mb-2" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2">
              <Skeleton className="h-7 w-7 rounded-md shrink-0" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-3 w-12 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const bars = useMemo(() => {
    return trendData.length > 0
      ? trendData
      : Array.from({ length: 30 }, () => Math.floor(Math.random() * 60) + 20);
  }, [trendData]);

  return (
    <div className="rounded-xl border-0 bg-slate-50 p-6 dark:bg-slate-900 shadow-none">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          Lead Discovery Trend
        </h3>
        <div className="flex items-center gap-1 rounded-lg border-0 bg-slate-100 dark:bg-slate-800/50 p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                period === p
                  ? "bg-white text-slate-900 dark:bg-slate-700 dark:text-white"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-end gap-1 h-28">
          {bars.map((height, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-[#14A800]/20 hover:bg-[#14A800]/40 transition-colors"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-slate-400">
          <span>Sep 1</span>
          <span>Sep 15</span>
          <span>Sep 30</span>
        </div>
      </div>

      <h4 className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        Recent Activity
      </h4>

      <div className="space-y-1">
        {events.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-slate-400">
            No recent activity found.
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
            >
              <div className={`flex h-7 w-7 items-center justify-center rounded-md ${typeConfig[event.type]?.bg || "bg-slate-100"}`}>
                <EventIcon type={event.type} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
                  {event.description}
                </p>
              </div>
              <span className="text-xs text-slate-400 shrink-0">{event.time}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
