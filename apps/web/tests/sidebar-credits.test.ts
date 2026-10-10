import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.PropsWithChildren<{ href: string }>) =>
    React.createElement("a", { ...props, href }, children),
}));
vi.mock("@/components/logo", () => ({
  Logo: () => React.createElement("span", null, "LeadsDom"),
}));
import { Sidebar } from "@/components/layout/sidebar";
import { walletCreditQueryOptions } from "@/lib/wallet-credits";
let client: QueryClient;
beforeEach(() => {
  vi.stubGlobal("React", React);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  client.clear();
  vi.unstubAllGlobals();
});
function render(credits?: number | null, mobileOpen = false, id = "user") {
  return renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(Sidebar, {
        user: { id, name: "Customer", email: "test@example.com", credits },
        mobileOpen,
      }),
    ),
  );
}
describe("Sidebar wallet credit card", () => {
  it.each([false, true])(
    "renders a formatted balance and billing CTA above both footers (drawer open=%s)",
    (mobileOpen) => {
      const html = render(51877, mobileOpen);
      expect(html.match(/data-sidebar-credits/g)).toHaveLength(2);
      expect(html.match(/51,877/g)).toHaveLength(4); // visible numbers + accessible labels
      expect(html.match(/Buy Credits/g)).toHaveLength(2);
      const chunks = html.split("data-sidebar-credits").slice(1);
      for (const chunk of chunks) {
        expect(chunk).toContain("Available Credits");
        expect(chunk.indexOf("Buy Credits")).toBeLessThan(
          chunk.indexOf('href="/dashboard/settings"'),
        );
        expect(chunk).toContain('href="/dashboard/billing"');
        expect(chunk).toContain('aria-live="polite"');
      }
    },
  );
  it("shows a real zero balance instead of a placeholder credit grant", () => {
    const html = render(0);
    expect(html).toContain('aria-label="0 Credits"');
    expect(html).not.toContain('aria-label="25 Credits"');
  });
  it("uses the refreshed account-scoped cache instead of stale session credits", () => {
    client.setQueryData(walletCreditQueryOptions("user").queryKey, 1234);
    expect(render(51877)).toContain('aria-label="1,234 Credits"');
    expect(render(51877)).not.toContain('aria-label="51,877 Credits"');
  });
  it("does not leak a previous user's balance into a new account", () => {
    client.setQueryData(walletCreditQueryOptions("other").queryKey, 51877);
    expect(render(0)).toContain('aria-label="0 Credits"');
  });
  it("keeps Buy Credits available while an unknown balance is loading", () => {
    const html = render(undefined);
    expect(html).toContain('aria-label="Credit balance unavailable"');
    expect(html).toContain("Buy Credits");
    expect(html).not.toContain('aria-label="0 Credits"');
  });
  it("preserves navigation, mobile inert handling and short-viewport scrolling", () => {
    const html = render(0);
    for (const text of [
      "Dashboard",
      "Search Leads",
      "My Leads Vault",
      "Billing",
      "Support",
      "Settings",
    ])
      expect(html).toContain(text);
    expect(html).toContain('inert=""');
    expect(html).toContain("h-dvh min-h-0 overflow-y-auto overflow-x-hidden");
    expect(html).toContain("mt-auto shrink-0 pt-6");
    expect(html).toContain("break-all");
    expect(html).toContain("min-h-11 w-full");
  });
  it("keeps both wallet cards flat, icon-free at the label, and preserves the plus CTA", () => {
    const html = render(51877, true);
    const cards =
      html.match(/<section[^>]*data-sidebar-credits[\s\S]*?<\/section>/g) ?? [];
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      expect(card).toContain("border border-blue-200 bg-white p-4 shadow-none");
      expect(card).not.toContain("bg-gradient");
      expect(card).not.toContain("shadow-sm");
      expect(card).not.toContain("lucide-coins");
      expect(card).not.toContain("ring-2");
      expect(card).toContain(">Available Credits</p>");
      expect(card).toContain("lucide-plus");
      expect(card).toContain("Buy Credits");
      expect(card).toContain('href="/dashboard/billing"');
      expect(card).toContain('aria-label="51,877 Credits"');
    }
  });
});
