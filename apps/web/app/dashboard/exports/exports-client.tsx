"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, Database, Download, FileSpreadsheet, Loader2 } from "lucide-react";

export interface ExportableState {
  code: string;
  name: string;
  leadCount: number;
}

export type ExportDisplayStatus = "Completed" | "Processing" | "Failed" | "Incomplete" | "Pending";

export interface ExportHistoryRow {
  id: string;
  stateLabel: string;
  agentCount: number;
  status: ExportDisplayStatus;
  createdAt: string;
}

const STATUS_STYLES: Record<ExportDisplayStatus, string> = {
  Completed: "bg-emerald-50 text-emerald-700",
  Processing: "bg-blue-50 text-blue-700",
  Pending: "bg-slate-100 text-slate-600",
  Incomplete: "bg-amber-50 text-amber-700",
  Failed: "bg-red-50 text-red-700",
};

function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function filenameFromDisposition(header: string | null, fallback: string): string {
  const match = header?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? fallback;
}

export function ExportsClient({ states, history }: { states: ExportableState[]; history: ExportHistoryRow[] }) {
  const router = useRouter();
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = useCallback(
    async (state: ExportableState) => {
      if (downloading) return;
      setDownloading(state.code);
      try {
        const res = await fetch(`/api/exports/stream?state=${encodeURIComponent(state.code)}`);
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `Export failed (${res.status})`);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filenameFromDisposition(
          res.headers.get("Content-Disposition"),
          `leadsdom-export-${state.code.toLowerCase()}.csv`,
        );
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success(`${state.name} export downloaded`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Export failed. Please try again.");
      } finally {
        setDownloading(null);
        router.refresh();
      }
    },
    [downloading, router],
  );

  if (states.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8">
        <div className="min-h-[320px] border border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-100">
            <Database className="h-6 w-6 text-slate-400" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-slate-900">Nothing to export yet</h2>
          <p className="mt-1.5 text-sm text-slate-500 max-w-sm">
            Exports become available as soon as you unlock a state. Order verified territories to get started.
          </p>
          <a
            href="/dashboard/search"
            className="mt-5 inline-flex items-center gap-1.5 h-9 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-md text-xs font-semibold transition-colors"
          >
            Order Leads Now
            <ChevronRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-5 sm:p-7">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-blue-600" />
          <h2 className="text-base font-semibold text-slate-900">Your unlocked states</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Each export is a CSV of every deliverable lead you&apos;ve unlocked in that state.
        </p>

        <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {states.map((state) => {
            const isBusy = downloading === state.code;
            const disabled = state.leadCount === 0 || (downloading !== null && !isBusy);
            return (
              <li
                key={state.code}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {state.name} <span className="font-normal text-slate-400">({state.code})</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {state.leadCount > 0 ? `${formatCount(state.leadCount)} leads` : "No deliverable leads yet"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownload(state)}
                  disabled={disabled || isBusy}
                  aria-label={`Download ${state.name} CSV`}
                  className="inline-flex shrink-0 items-center gap-1.5 h-10 sm:h-8 px-3 rounded-md bg-blue-600 text-white text-xs font-semibold transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  {isBusy ? "Preparing…" : "CSV"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl bg-white p-5 sm:p-7">
        <h2 className="text-base font-semibold text-slate-900">Export history</h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No exports yet. Your downloads will appear here.</p>
        ) : (
          <>
          {/* Below sm: stacked cards instead of a sideways-scrolling table */}
          <ul className="mt-4 divide-y divide-slate-100 sm:hidden">
            {history.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 break-words">{row.stateLabel}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatDateTime(row.createdAt)} · {formatCount(row.agentCount)} leads
                  </p>
                </div>
                <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[row.status]}`}>
                  {row.status}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">State</th>
                  <th className="py-2 pr-4 font-medium text-right">Leads</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-3 pr-4 text-slate-600 whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                    <td className="py-3 pr-4 font-medium text-slate-900">{row.stateLabel}</td>
                    <td className="py-3 pr-4 text-right tabular-nums text-slate-600">{formatCount(row.agentCount)}</td>
                    <td className="py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[row.status]}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>
    </div>
  );
}
