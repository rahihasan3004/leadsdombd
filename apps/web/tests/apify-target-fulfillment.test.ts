import { afterEach, describe, expect, it, vi } from "vitest";
import { selectApifyEmail } from "../src/lib/scraper/apify-mapper";
import {
  nextApifyZip,
  apifyMaxFulfillmentRuns,
} from "../src/lib/scraper/apify-deficit";
import { buildApifySearchStrings } from "../src/lib/scraper/apify-client";
import { orderDeliveryEta } from "../src/lib/order-delivery-eta";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { OrderProcessingNotice } from "../src/components/dashboard/order-processing-notice";
afterEach(() => vi.unstubAllEnvs());
describe("native Apify email selection", () => {
  it("selects the first domain-valid array entry", () => {
    expect(
      selectApifyEmail({
        emails: [
          null,
          "bad",
          "x@-bad.com",
          " SALES@EXAMPLE.COM ",
          "later@example.com",
        ],
      }),
    ).toBe("sales@example.com");
  });
  it("uses singular fallback for missing/empty/invalid arrays", () => {
    expect(selectApifyEmail({ emails: [], email: "hello@example.com" })).toBe(
      "hello@example.com",
    );
    expect(
      selectApifyEmail({ emails: ["bad"], email: "hello@example.com" }),
    ).toBe("hello@example.com");
  });
  it("keeps no-email inventory unverified", () => {
    expect(selectApifyEmail({ emails: ["bad", null] })).toBeNull();
  });
});
describe("durable ZIP coverage", () => {
  it("does not repeat legacy multi-ZIP searches", () => {
    const used = buildApifySearchStrings({
      stateCode: "GA",
      maxQueries: 20,
    }).map((q) => q.match(/ (\d{5})$/)![1]);
    const next = nextApifyZip(
      ["GA"],
      [
        {
          state: "GA",
          targetQuantity: 100,
          zipCode: null,
          runId: "apify:token:run",
        },
      ],
    );
    expect(next).not.toBeNull();
    expect(used).not.toContain(next!.zipCode);
  });
  it("reserves queued ZIPs before provider dispatch", () => {
    const first = nextApifyZip(["GA"], [])!;
    const second = nextApifyZip(
      ["GA"],
      [{ ...first, targetQuantity: 51, runId: null }],
    )!;
    expect(second.zipCode).not.toBe(first.zipCode);
  });
  it("bounds paid runs even with malformed configuration", () => {
    vi.stubEnv("APIFY_MAX_FULFILLMENT_RUNS", "infinity");
    expect(apifyMaxFulfillmentRuns()).toBe(20);
    vi.stubEnv("APIFY_MAX_FULFILLMENT_RUNS", "3");
    expect(apifyMaxFulfillmentRuns()).toBe(3);
  });
});
it.each([
  [20, "Est. 1–2 mins"],
  [21, "Est. 3–5 mins"],
  [100, "Est. 3–5 mins"],
  [101, "Est. 8–15 mins"],
  [500, "Est. 8–15 mins"],
  [501, "Est. 15–30 mins"],
])("shows the ETA boundary %s", (quantity, expected) => {
  expect(orderDeliveryEta(Number(quantity))).toBe(expected);
});
it("renders helper text only for processing orders", () => {
  const html = renderToStaticMarkup(
    createElement(OrderProcessingNotice, {
      status: "PROCESSING",
      onDismiss: () => {},
    }),
  );
  expect(html).toContain("Dismiss processing notice");
  expect(html).toContain(
    "You will receive an email confirmation once completed.",
  );
  expect(
    renderToStaticMarkup(
      createElement(OrderProcessingNotice, {
        status: "COMPLETED",
      }),
    ),
  ).toBe("");
});
