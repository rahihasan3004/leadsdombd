"use client";

import { useState } from "react";
import { TrendingUp, Users, FileSearch, ShieldCheck } from "lucide-react";

interface ActivityEvent {
  id: string;
  type: "verified" | "exported" | "searched" | "unlocked";
  description: string;
  time: string;
  state?: string;
}

const MOCK_ACTIVITIES: ActivityEvent[] = [
  { id: "1", type: "verified", description: "200 FL luxury agents verified", time: "2h ago", state: "FL" },
  { id: "2", type: "exported", description: "CA Top Producers CSV exported", time: "5h ago", state: "CA" },
  { id: "3", type: "searched", description: "Ran discovery on Austin brokers", time: "8h ago", state: "TX" },
  { id: "4", type: "unlocked", description: "Unlocked NY Elite Agent vault", time: "1d ago", state: "NY" },
  { id: "5", type: "verified", description: "AZ market leader verification complete", time: "1d ago", state: "AZ" },
];

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

export function ActivityFeed() {
  const [period, setPeriod] = useState<string>("30D");

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
          {[35, 48, 30, 62, 55, 42, 70, 58, 45, 75, 65, 50, 80, 68, 52, 85, 72, 58, 90, 78, 62, 95, 82, 68, 100, 88, 72, 95, 85, 65].map((height, i) => (
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
        {MOCK_ACTIVITIES.map((event) => (
          <div
            key={event.id}
            className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
          >
            <div className={`flex h-7 w-7 items-center justify-center rounded-md ${typeConfig[event.type].bg}`}>
              <EventIcon type={event.type} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
                {event.description}
              </p>
            </div>
            <span className="text-xs text-slate-400 shrink-0">{event.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}