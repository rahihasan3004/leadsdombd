import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardPagination } from "@/components/ui/dashboard-pagination";
import { getPaginationItems } from "@/lib/pagination";

describe("sliding pagination window", () => {
  it.each([1, 2, 3, 4, 5])("shows every page for a %i-page result", (total) => {
    expect(getPaginationItems(1, total)).toEqual(Array.from({ length: total }, (_, i) => i + 1));
  });

  it("shows a compact start window", () => {
    expect(getPaginationItems(1, 10)).toEqual([1, 2, 3, "ellipsis-end", 10]);
  });

  it("shows the current page and its neighbors in the middle", () => {
    expect(getPaginationItems(5, 10)).toEqual([1, "ellipsis-start", 4, 5, 6, "ellipsis-end", 10]);
  });

  it("shows a compact end window", () => {
    expect(getPaginationItems(50, 50)).toEqual([1, "ellipsis-start", 48, 49, 50]);
  });

  it("clamps out-of-range current pages", () => {
    expect(getPaginationItems(0, 10)).toEqual(getPaginationItems(1, 10));
    expect(getPaginationItems(99, 10)).toEqual(getPaginationItems(10, 10));
    expect(getPaginationItems(Number.NaN, 10)).toEqual(getPaginationItems(1, 10));
  });

  it("returns no controls for an empty or invalid result", () => {
    expect(getPaginationItems(1, 0)).toEqual([]);
    expect(getPaginationItems(1, -1)).toEqual([]);
    expect(getPaginationItems(1, Number.NaN)).toEqual([]);
  });

  it("keeps every window ordered, unique and bounded for 6–50 pages", () => {
    for (let total = 6; total <= 50; total++) {
      for (let current = 1; current <= total; current++) {
        const items = getPaginationItems(current, total);
        const numbers = items.filter((item): item is number => typeof item === "number");
        expect(items.length).toBeLessThanOrEqual(7);
        expect(numbers.length).toBeLessThanOrEqual(5);
        expect(numbers[0]).toBe(1);
        expect(numbers.at(-1)).toBe(total);
        expect(numbers).toContain(current);
        if (current > 1) expect(numbers).toContain(current - 1);
        if (current < total) expect(numbers).toContain(current + 1);
        expect(numbers).toEqual([...new Set(numbers)].sort((a, b) => a - b));
        expect(typeof items[0]).toBe("number");
        expect(typeof items.at(-1)).toBe("number");
      }
    }
  });

  it("does not allocate an array proportional to large page counts", () => {
    expect(getPaginationItems(500000, 1000000)).toEqual([
      1, "ellipsis-start", 499999, 500000, 500001, "ellipsis-end", 1000000,
    ]);
  });
});

describe("accessible pagination controls", () => {
  // This workspace's Vitest transform uses classic JSX; Next uses the automatic runtime.
  beforeEach(() => vi.stubGlobal("React", React));
  afterEach(() => vi.unstubAllGlobals());
  it("renders ellipses as non-clickable spans and marks the active page", () => {
    const html = renderToStaticMarkup(createElement(DashboardPagination, {
      currentPage: 25, totalPages: 50, onPageChange: () => {}, label: "Orders pagination",
    }));
    expect(html.match(/<button/g)).toHaveLength(7);
    expect(html.match(/Skipped pages/g)).toHaveLength(2);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Orders pagination"');
    expect(html).toContain('aria-label="Previous page"');
    expect(html).toContain('aria-label="Next page"');
    expect(html).toContain('flex-nowrap');
    expect(html).not.toContain('flex-wrap ');
  });

  it("disables both directions for a single page and never submits forms", () => {
    const html = renderToStaticMarkup(createElement(DashboardPagination, {
      currentPage: 1, totalPages: 1, onPageChange: () => {},
    }));
    expect(html.match(/disabled=""/g)).toHaveLength(2);
    expect(html.match(/type="button"/g)).toHaveLength(3);
    expect(html).not.toContain("Skipped pages");
  });
});
