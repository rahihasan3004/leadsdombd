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
    expect(html).toContain("Processing / Collecting Leads");
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
    expect(source).toContain("15_000");
    expect(
      source.match(/disabled=\{!isOrderDownloadable\(purchase.status\)\}/g),
    ).toHaveLength(4);
    expect(source).toContain(
      "if (!purchase || !isOrderDownloadable(purchase.status)) return;",
    );
  });
});
