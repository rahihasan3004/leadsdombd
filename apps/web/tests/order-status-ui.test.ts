import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  OrderStatusBadge,
  isOrderDownloadable,
} from "../src/components/dashboard/order-status-badge";
beforeAll(() => vi.stubGlobal("React", React));
describe("pending Vault order presentation", () => {
  it("shows a collecting badge with a motion-safe animation", () => {
    const html = renderToStaticMarkup(
      React.createElement(OrderStatusBadge, { status: "PROCESSING" }),
    );
    expect(html).toContain("Processing");
    expect(html).not.toContain("Collecting Leads");
    expect(html).toContain("whitespace-nowrap");
    expect(html).toContain("motion-safe:animate-spin");
    expect(html).toContain('role="status"');
  });
  it.each(["PROCESSING", "PENDING", "FAILED", "REFUNDED"])(
    "prevents downloads for %s",
    (status) => {
      expect(isOrderDownloadable(status)).toBe(false);
    },
  );
  it("only enables completed order downloads", () => {
    expect(isOrderDownloadable("COMPLETED")).toBe(true);
  });
  it("guards every mapped order action and auto-refreshes pending orders", () => {
    const source = readFileSync(
      new URL("../app/dashboard/lists/page.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain('purchase.status === "PROCESSING"');
    expect(source).toContain("VAULT_SYNC_INTERVAL_MS");
    expect(source).toContain("createVaultOrderSync({");
    expect(source).toContain("orderSync.current?.setPurchaseIds(");
    expect(source).not.toContain("syncAttempts");
    expect(
      source.match(/disabled=\{!isOrderDownloadable\(purchase.status\)\}/g),
    ).toHaveLength(2);
    expect(source.match(/<VaultExportControl purchase={/g)).toHaveLength(4);
    const control = readFileSync(
      new URL(
        "../src/components/dashboard/vault-export-control.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    expect(control).toContain("!isOrderDownloadable(purchase.status)");
    expect(control).toContain("disabled={disabled}");
    expect(control).toContain("if (disabled || request.current) return;");
  });
});
