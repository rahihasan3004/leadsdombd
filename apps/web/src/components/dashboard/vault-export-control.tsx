"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Download, ChevronDown, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useModalA11y } from "@/hooks/use-modal-a11y";
import { isOrderDownloadable } from "./order-status-badge";
import {
  isMultiStateExport,
  type LeadExportFormat,
  type LeadExportGrouping,
} from "@/lib/export-options";
import { downloadLeadExport } from "@/lib/download-lead-export";
interface ExportPurchase {
  id: string;
  referenceId: string;
  unlockedStates: string[];
  status: string;
}
export function VaultExportControl({
  purchase,
  className = "",
}: {
  purchase: ExportPurchase;
  className?: string;
}) {
  const [format, setFormat] = useState<LeadExportFormat>("csv");
  const [grouping, setGrouping] = useState<LeadExportGrouping>("combined");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const multi = isMultiStateExport(purchase.unlockedStates);
  const disabled = !isOrderDownloadable(purchase.status) || busy;
  const close = useCallback(() => {
    request.current?.abort();
    setOpen(false);
  }, []);
  useModalA11y(dialog, open, close);
  useEffect(() => () => request.current?.abort(), []);
  async function download() {
    if (disabled || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(null);
    try {
      await downloadLeadExport(
        {
          purchaseId: purchase.id,
          states: purchase.unlockedStates,
          format,
          grouping: multi ? grouping : "combined",
        },
        controller.signal,
      );
      setOpen(false);
      toast.success("Export downloaded");
    } catch (cause) {
      if (!controller.signal.aborted) {
        const message =
          cause instanceof Error
            ? cause.message
            : "Export failed. Please retry.";
        setError(message);
        toast.error(message);
      }
    } finally {
      request.current = null;
      setBusy(false);
    }
  }
  return (
    <>
      <div
        className={`inline-flex items-center gap-1 ${className}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setError(null);
            if (multi) setOpen(true);
            else void download();
          }}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Export order ${purchase.referenceId}`}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {busy ? "Preparing…" : multi ? "Export" : format.toUpperCase()}
        </button>
        {!multi && (
          <div className="relative flex h-9 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
            <ChevronDown className="h-3.5 w-3.5 pointer-events-none" />
            <select
              aria-label="Export format"
              title="Choose CSV or JSON"
              disabled={disabled}
              value={format}
              onChange={(event) =>
                setFormat(event.target.value as LeadExportFormat)
              }
              className="absolute inset-0 w-full cursor-pointer opacity-0"
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </div>
        )}
      </div>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4"
            onClick={(event) => {
              event.stopPropagation();
              if (event.target === event.currentTarget) close();
            }}
          >
            <div
              ref={dialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`export-title-${purchase.id}`}
              aria-describedby={`export-description-${purchase.id}`}
              tabIndex={-1}
              className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <h2
                  id={`export-title-${purchase.id}`}
                  className="text-lg font-bold text-slate-900"
                >
                  Export Options
                </h2>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close export options"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p
                id={`export-description-${purchase.id}`}
                className="mt-1 text-sm text-slate-500"
              >
                Order {purchase.referenceId}. Export all purchased states
                together or download separate state files.
              </p>
              <fieldset disabled={busy} className="mt-5">
                <legend className="text-sm font-semibold text-slate-800">
                  Choose Format
                </legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(["csv", "json"] as const).map((value) => (
                    <label
                      key={value}
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${format === value ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-700"}`}
                    >
                      <input
                        type="radio"
                        name={`export-format-${purchase.id}`}
                        value={value}
                        checked={format === value}
                        onChange={() => setFormat(value)}
                      />
                      {value.toUpperCase()}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset disabled={busy} className="mt-5">
                <legend className="text-sm font-semibold text-slate-800">
                  Grouping Options
                </legend>
                <div className="mt-2 space-y-2">
                  {(
                    [
                      {
                        value: "combined",
                        title: "Combined (Single File)",
                        description:
                          "One file containing leads from every purchased state.",
                      },
                      {
                        value: "split",
                        title: "Split by State (.ZIP Archive)",
                        description:
                          "Individual state files packaged in one ZIP download.",
                      },
                    ] as const
                  ).map((option) => (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${grouping === option.value ? "border-blue-600 bg-blue-50" : "border-slate-200"}`}
                    >
                      <input
                        className="mt-1"
                        type="radio"
                        name={`export-grouping-${purchase.id}`}
                        value={option.value}
                        checked={grouping === option.value}
                        onChange={() => setGrouping(option.value)}
                      />
                      <span>
                        <span className="block text-sm font-semibold text-slate-800">
                          {option.title}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {option.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {error && (
                <p role="alert" className="mt-4 text-sm text-red-600">
                  {error}
                </p>
              )}
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => void download()}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {busy ? "Preparing export…" : "Download"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
