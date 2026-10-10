import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { OrderStatusBadge } from "../src/components/dashboard/order-status-badge";
import { OrderProcessingNotice } from "../src/components/dashboard/order-processing-notice";
const page = readFileSync(
  new URL("../app/dashboard/lists/page.tsx", import.meta.url),
  "utf8",
);
it.each([
  [10, "1–2m"],
  [100, "3–5m"],
  [500, "8–15m"],
  [501, "15–30m"],
])("renders a compact quantity-aware badge for %s", (quantity, eta) => {
  const html = renderToStaticMarkup(
    createElement(OrderStatusBadge, {
      status: "PROCESSING",
      quantity: Number(quantity),
    }),
  );
  expect(html).toContain("Processing (Est. " + eta + ")");
  expect(html).toContain("whitespace-nowrap");
  expect(html).toContain("motion-safe:animate-spin");
  expect(html).not.toContain("Your order is actively being gathered");
  expect(html).not.toMatch(/<p(?:\s|>)/);
});
it.each([
  ["COMPLETED", "Completed"],
  ["REFUNDED", "Refunded"],
  ["FAILED", "Failed"],
])("keeps %s status compact without an ETA", (status, label) => {
  const html = renderToStaticMarkup(
    createElement(OrderStatusBadge, { status, quantity: 10 }),
  );
  expect(html).toContain(label);
  expect(html).not.toContain("Est.");
});
it("places exactly one dismissible notice outside the orders table and never within mapped rows", () => {
  expect(page.match(/<OrderProcessingNotice/g)).toHaveLength(1);
  expect(page).toContain("!processingNoticeDismissed");
  expect(page).toContain("setProcessingNoticeDismissed(true)");
  expect(page.indexOf("<OrderProcessingNotice")).toBeLessThan(
    page.lastIndexOf("min-w-[900px]"),
  );
  const table = page.slice(
    page.lastIndexOf("min-w-[900px]"),
    page.indexOf("</table>", page.lastIndexOf("min-w-[900px]")),
  );
  expect(table).not.toContain("OrderProcessingNotice");
  expect(table.match(/<td className="px-4 py-2 align-middle/g)).toHaveLength(6);
  expect(table).toContain("quantity={purchase.quantity}");
});
it("keeps the helper available once, without an ETA paragraph", () => {
  const html = renderToStaticMarkup(
    createElement(OrderProcessingNotice, {
      status: "PROCESSING",
      onDismiss: () => {},
    }),
  );
  expect(html).toContain(
    "You will receive an email confirmation once completed.",
  );
  expect(html).toContain('type="button"');
  expect(html).toContain("Dismiss processing notice");
  expect(html).not.toContain("Est.");
});
