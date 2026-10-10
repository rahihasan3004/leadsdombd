import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VaultExportControl } from "@/components/dashboard/vault-export-control";
import { downloadLeadExport } from "@/lib/download-lead-export";
import { isMultiStateExport } from "@/lib/export-options";
let click: ReturnType<typeof vi.fn>,
  remove: ReturnType<typeof vi.fn>,
  anchor: {
    href: string;
    download: string;
    click: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("React", React);
  click = vi.fn();
  remove = vi.fn();
  anchor = { href: "", download: "", click, remove };
  vi.stubGlobal("document", {
    body: { appendChild: vi.fn() },
    createElement: vi.fn(() => anchor),
  });
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.runAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const options = {
  purchaseId: "p1",
  states: ["TX", "GA"],
  format: "csv" as const,
  grouping: "combined" as const,
};
function attachment(
  body: string,
  type = "text/csv; charset=utf-8",
  ext = "csv",
) {
  return new Response(body, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="leadsdom-export-all-123.${ext}"`,
      "Content-Length": String(Buffer.byteLength(body)),
    },
  });
}
describe("Vault export selection and downloads", () => {
  it("shows a single Export button with dialog semantics for single-state orders", () => {
    const html = renderToStaticMarkup(
      React.createElement(VaultExportControl, {
        purchase: {
          id: "p1",
          referenceId: "order",
          unlockedStates: ["TX"],
          status: "COMPLETED",
        },
      }),
    );
    expect(html).toContain(">Export<");
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).not.toContain('aria-label="Export format"');
    expect(html).not.toContain("<select");
    expect(html).not.toContain('role="dialog"');
  });
  it.each([["TX", "GA"], ["ALL"], ["All States"]])(
    "offers Export Options for %j",
    (...states) => {
      const actual = states as string[];
      const html = renderToStaticMarkup(
        React.createElement(VaultExportControl, {
          purchase: {
            id: "p1",
            referenceId: "order",
            unlockedStates: actual,
            status: "COMPLETED",
          },
        }),
      );
      expect(html).toContain(">Export<");
      expect(html).not.toContain('aria-label="Export format"');
      expect(isMultiStateExport(actual)).toBe(true);
    },
  );
  it("keeps pending and refunded orders non-exportable", () => {
    for (const status of ["PROCESSING", "REFUNDED"]) {
      const html = renderToStaticMarkup(
        React.createElement(VaultExportControl, {
          purchase: {
            id: "p1",
            referenceId: "order",
            unlockedStates: ["TX"],
            status,
          },
        }),
      );
      expect(html).toContain('disabled=""');
    }
  });
  it("sends one API request for multiple states and uses the server filename", async () => {
    const fetcher = vi.fn().mockResolvedValue(attachment("csv"));
    vi.stubGlobal("fetch", fetcher);
    await downloadLeadExport(options);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]![0]).toContain("states=TX%2CGA");
    expect(fetcher.mock.calls[0]![0]).toContain("purchaseId=p1");
    expect(anchor.download).toBe("leadsdom-export-all-123.csv");
    expect(click).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
  });
  it("sends JSON and ZIP grouping together in one request", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(attachment("zip", "application/zip", "zip"));
    vi.stubGlobal("fetch", fetcher);
    await downloadLeadExport({ ...options, format: "json", grouping: "split" });
    expect(fetcher.mock.calls[0]![0]).toContain("format=json&grouping=split");
    expect(anchor.download).toMatch(/\.zip$/);
  });
  it("shows server errors instead of downloading an error body as stream.txt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Please retry the export" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    await expect(downloadLeadExport(options)).rejects.toThrow(
      "Please retry the export",
    );
    expect(click).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it("refuses partial blobs, unexpected types, and missing attachment filenames", async () => {
    const badLength = attachment("csv");
    badLength.headers.set("Content-Length", "100");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(badLength)
        .mockResolvedValueOnce(
          new Response("login", { headers: { "Content-Type": "text/html" } }),
        )
        .mockResolvedValueOnce(
          new Response("csv", { headers: { "Content-Type": "text/csv" } }),
        ),
    );
    await expect(downloadLeadExport(options)).rejects.toThrow("interrupted");
    await expect(downloadLeadExport(options)).rejects.toThrow("Unexpected");
    await expect(downloadLeadExport(options)).rejects.toThrow("filename");
    expect(click).not.toHaveBeenCalled();
  });
  it("does not save cancelled downloads", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(attachment("csv")));
    await expect(
      downloadLeadExport(options, controller.signal),
    ).rejects.toThrow("cancelled");
    expect(click).not.toHaveBeenCalled();
  });
  it("accepts decoded gzip downloads without comparing compressed wire length to blob size", async () => {
    const response = attachment("decoded csv");
    response.headers.set("Content-Encoding", "gzip");
    response.headers.set("Content-Length", "1");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await downloadLeadExport(options);
    expect(click).toHaveBeenCalledOnce();
  });
  it("does not save a blob when response transport terminates", async () => {
    const response = attachment("csv");
    vi.spyOn(response, "blob").mockRejectedValue(new Error("terminated"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(downloadLeadExport(options)).rejects.toThrow("interrupted");
    expect(click).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it("accepts an Excel attachment with its XLSX MIME type and server filename", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          attachment(
            "xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "xlsx",
          ),
        ),
    );
    await downloadLeadExport({ ...options, format: "xlsx" });
    expect(anchor.download).toBe("leadsdom-export-all-123.xlsx");
    expect(click).toHaveBeenCalledOnce();
    expect(vi.mocked(fetch).mock.calls[0]![0]).toContain("format=xlsx");
  });
});
