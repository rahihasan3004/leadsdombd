import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const state = vi.hoisted(() => ({ index: 0 }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => [
      state.index++ === 2 ? true : initial,
      vi.fn(),
    ],
  };
});
vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return { ...actual, createPortal: (children: React.ReactNode) => children };
});
import { VaultExportControl } from "@/components/dashboard/vault-export-control";
beforeEach(() => {
  state.index = 0;
  vi.stubGlobal("React", React);
  vi.stubGlobal("document", { body: {} });
});
afterEach(() => vi.unstubAllGlobals());
describe("Unified Vault Export Options dialog", () => {
  it.each([["TX"], ["TX", "GA"], ["ALL"]])(
    "shows three formats and clipboard action for %j",
    (...states) => {
      const html = renderToStaticMarkup(
        React.createElement(VaultExportControl, {
          purchase: {
            id: "p1",
            referenceId: "order",
            status: "COMPLETED",
            unlockedStates: states as string[],
          },
        }),
      );
      expect(html).toContain('role="dialog"');
      expect(html).toContain("Export Options");
      expect(html).toContain('value="csv"');
      expect(html).toContain('value="xlsx"');
      expect(html).toContain('value="json"');
      expect(html).toContain("Excel (.xlsx)");
      expect(html).toContain("Copy for Google Sheets");
      expect(html).toContain("Combined (Single File)");
      if (states.length === 1 && states[0] === "TX")
        expect(html).not.toContain("Split by State");
      else expect(html).toContain("Split by State (.ZIP Archive)");
    },
  );
});
