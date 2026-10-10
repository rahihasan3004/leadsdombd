export const CLIPBOARD_EXPORT_LIMIT = 8 * 1024 * 1024;
async function leadTsv(
  purchaseId: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const params = new URLSearchParams({
    purchaseId,
    format: "tsv",
    grouping: "combined",
  });
  const response = await fetch(`/api/exports/stream?${params}`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      body?.error ?? "Could not prepare clipboard copy. Please retry.",
    );
  }
  if (
    !response.headers
      .get("Content-Type")
      ?.toLowerCase()
      .startsWith("text/tab-separated-values")
  )
    throw new Error("Unexpected clipboard response. Please retry.");
  const length = response.headers.get("Content-Length");
  if (length && Number(length) > CLIPBOARD_EXPORT_LIMIT) {
    await response.body?.cancel();
    throw new Error(
      "This order is too large for clipboard copy. Download Excel instead.",
    );
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Clipboard export is empty. Please retry.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      if (signal?.aborted)
        throw new DOMException("Copy cancelled", "AbortError");
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > CLIPBOARD_EXPORT_LIMIT)
        throw new Error(
          "This order is too large for clipboard copy. Download Excel instead.",
        );
      chunks.push(part.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  if (signal?.aborted) throw new DOMException("Copy cancelled", "AbortError");
  const encoding = response.headers.get("Content-Encoding")?.toLowerCase();
  if (
    length &&
    (!encoding || encoding === "identity") &&
    Number(length) !== size
  )
    throw new Error("Clipboard export was interrupted. Please retry.");
  // A copied buffer is Blob-compatible with both browser and newer TypeScript ArrayBuffer types.
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new Blob([bytes.buffer], { type: "text/plain" });
}
/** Called directly from a click. Promise-backed ClipboardItem preserves user activation on supported browsers. */
export async function copyLeadExport(purchaseId: string, signal?: AbortSignal) {
  if (typeof navigator === "undefined" || !navigator.clipboard)
    throw new Error(
      "Clipboard access requires HTTPS and a supported browser. Download CSV or Excel instead.",
    );
  const content = leadTsv(purchaseId, signal);
  void content.catch(() => undefined);
  try {
    if (
      typeof ClipboardItem !== "undefined" &&
      typeof navigator.clipboard.write === "function"
    )
      await navigator.clipboard.write([
        new ClipboardItem({ "text/plain": content }),
      ]);
    else if (typeof navigator.clipboard.writeText === "function")
      await navigator.clipboard.writeText(await (await content).text());
    else throw new Error("Clipboard copying is not supported by this browser.");
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === "NotAllowedError" || error.name === "SecurityError")
    )
      throw new Error(
        "Clipboard permission was denied. Allow clipboard access or download CSV/Excel instead.",
      );
    throw error;
  }
}
