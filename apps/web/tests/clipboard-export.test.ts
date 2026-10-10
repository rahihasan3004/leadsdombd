import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { copyLeadExport, CLIPBOARD_EXPORT_LIMIT } from "@/lib/copy-lead-export";
const table = "Company Name\tZip Code\r\nRealty\t02108\r\n";
const response = () =>
  new Response(table, {
    headers: {
      "Content-Type": "text/tab-separated-values; charset=utf-8",
      "Content-Length": String(Buffer.byteLength(table)),
    },
  });
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response()));
  vi.stubGlobal("ClipboardItem", undefined);
});
afterEach(() => vi.unstubAllGlobals());
describe("Google Sheets clipboard export", () => {
  it("requests one server-redacted TSV for the whole owned order and writes text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await copyLeadExport("p1");
    expect(fetch).toHaveBeenCalledOnce();
    expect(vi.mocked(fetch).mock.calls[0]![0]).toBe(
      "/api/exports/stream?purchaseId=p1&format=tsv&grouping=combined",
    );
    expect(writeText).toHaveBeenCalledWith(table);
  });
  it("calls promise-backed clipboard write before fetching finishes to retain click activation", async () => {
    let content: Promise<Blob> | undefined;
    class Item {
      constructor(values: Record<string, Promise<Blob>>) {
        content = values["text/plain"];
      }
    }
    vi.stubGlobal("ClipboardItem", Item);
    const write = vi.fn(async () => {
      expect(content).toBeDefined();
      expect(await (await content!).text()).toBe(table);
    });
    vi.stubGlobal("navigator", { clipboard: { write } });
    await copyLeadExport("p1");
    expect(write).toHaveBeenCalledOnce();
  });
  it("refuses unsupported clipboard access without fetching data", async () => {
    vi.stubGlobal("navigator", {});
    await expect(copyLeadExport("p1")).rejects.toThrow("requires HTTPS");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("gives a useful permission error and never reports copy success", async () => {
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi
          .fn()
          .mockRejectedValue(new DOMException("Denied", "NotAllowedError")),
      },
    });
    await expect(copyLeadExport("p1")).rejects.toThrow("permission was denied");
  });
  it("does not copy error bodies or unexpected response types", async () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Order unavailable" }), {
        status: 403,
      }),
    );
    await expect(copyLeadExport("p1")).rejects.toThrow("Order unavailable");
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("login", { headers: { "Content-Type": "text/html" } }),
    );
    await expect(copyLeadExport("p1")).rejects.toThrow("Unexpected");
    expect(writeText).not.toHaveBeenCalled();
  });
  it("bounds clipboard content before writing and catches partial transfers", async () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const big = response();
    big.headers.set("Content-Length", String(CLIPBOARD_EXPORT_LIMIT + 1));
    vi.mocked(fetch).mockResolvedValueOnce(big);
    await expect(copyLeadExport("p1")).rejects.toThrow("too large");
    const partial = response();
    partial.headers.set("Content-Length", "999");
    vi.mocked(fetch).mockResolvedValueOnce(partial);
    await expect(copyLeadExport("p1")).rejects.toThrow("interrupted");
    expect(writeText).not.toHaveBeenCalled();
  });
  it("does not copy a cancelled export", async () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const controller = new AbortController();
    controller.abort();
    await expect(copyLeadExport("p1", controller.signal)).rejects.toThrow(
      "cancelled",
    );
    expect(writeText).not.toHaveBeenCalled();
  });
});
