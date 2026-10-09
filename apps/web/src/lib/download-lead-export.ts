import {
  type LeadExportFormat,
  type LeadExportGrouping,
} from "./export-options";
export async function downloadLeadExport(
  options: {
    purchaseId: string;
    states: string[];
    format: LeadExportFormat;
    grouping: LeadExportGrouping;
  },
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    purchaseId: options.purchaseId,
    format: options.format,
    grouping: options.grouping,
  });
  if (options.states.length) params.set("states", options.states.join(","));
  // Exactly one request, including All States. Never launch a browser download per state.
  const response = await fetch(`/api/exports/stream?${params}`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? "Export failed. Please retry.");
  }
  const expected =
    options.grouping === "split"
      ? "application/zip"
      : options.format === "csv"
        ? "text/csv"
        : "application/json";
  if (!response.headers.get("Content-Type")?.toLowerCase().startsWith(expected))
    throw new Error("Unexpected export response. Please retry.");
  const filename = response.headers
    .get("Content-Disposition")
    ?.match(/filename="(leadsdom-export-[a-z0-9-]+\.(?:csv|json|zip))"/i)?.[1];
  if (!filename) throw new Error("Export filename is missing. Please retry.");
  let blob: Blob;
  try {
    blob = await response.blob();
  } catch {
    throw new Error("Export download was interrupted. Please retry.");
  }
  if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
  const length = response.headers.get("Content-Length");
  const encoding = response.headers.get("Content-Encoding")?.toLowerCase();
  if (
    length &&
    (!encoding || encoding === "identity") &&
    Number(length) !== blob.size
  )
    throw new Error("Export download was interrupted. Please retry.");
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
