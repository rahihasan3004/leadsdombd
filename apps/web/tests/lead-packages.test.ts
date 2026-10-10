import { beforeEach, describe, expect, it, vi } from "vitest";
import { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  getLeadCreditCost,
  LEAD_PACKAGES,
  VOLUME_PRICING_TIERS,
  type LeadTier,
} from "@fine-leads/utils";

const controls = vi.hoisted(() => ({
  tier: "VERIFIED_EMAIL" as "PHONE_ONLY" | "VERIFIED_EMAIL",
  hookIndex: 0,
  query: vi.fn(),
  fetch: vi.fn(),
  invalidate: vi.fn(),
  push: vi.fn(),
}));

// Render the actual component with deterministic client-hook values. No DOM or
// database is needed; the checkout callback still constructs the real payload.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const values = [["CA"], 1000, "1000", false, controls.tier];
      const idx = controls.hookIndex++;
      return [idx < values.length ? values[idx] : initial, vi.fn()];
    },
    useMemo: (fn: () => unknown) => fn(),
    useCallback: (fn: unknown) => fn,
  };
});
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => {
    controls.query(options);
    return { data: 5000, isLoading: false };
  },
  useQueryClient: () => ({ invalidateQueries: controls.invalidate }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: controls.push }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@fine-leads/ui", () => ({
  Popover: ({ children }: { children: ReactNode }) =>
    createElement("div", null, children),
  PopoverTrigger: ({ children }: { children: ReactNode }) =>
    createElement("div", null, children),
  PopoverContent: ({ children }: { children: ReactNode }) =>
    createElement("div", null, children),
}));
vi.mock("@/components/ui/branded-loader", () => ({
  BrandedLoader: () => null,
}));

import { LeadOrderEngine } from "@/components/dashboard/search/lead-order-engine";

beforeEach(() => {
  controls.hookIndex = 0;
  controls.tier = "VERIFIED_EMAIL";
  controls.fetch.mockResolvedValue(
    new Response(JSON.stringify({ unlockedCount: 1000 }), { status: 200 }),
  );
  vi.stubGlobal("fetch", controls.fetch);
  // Vitest currently uses the classic JSX transform; Next uses automatic JSX.
  vi.stubGlobal("React", { createElement });
});

function checkoutCallback(node: ReactNode): (() => Promise<void>) | undefined {
  if (
    !isValidElement<{ children?: ReactNode; onClick?: () => Promise<void> }>(
      node,
    )
  )
    return;
  if (
    node.type === "button" &&
    typeof node.props.children === "string" &&
    node.props.children.startsWith("Unlock ")
  ) {
    return node.props.onClick;
  }
  for (const child of Children.toArray(node.props.children)) {
    const callback = checkoutCallback(child);
    if (callback) return callback;
  }
}

describe("credit bundle pricing", () => {
  it.each([
    [500, 15],
    [1000, 25],
    [2000, 39],
    [10000, 169],
    [30000, 449],
    [50000, 649],
  ])(
    "keeps %i credits at %i USD with an accurate per-credit price",
    (credits, price) => {
      const tier = VOLUME_PRICING_TIERS.find(
        (item) => item.credits === credits,
      )!;
      expect(tier.price).toBe(price);
      expect(tier.unitPrice).toBeCloseTo(price / credits, 10);
    },
  );
});

describe("lead package UI", () => {
  it.each<[{ tier: LeadTier; quantity: number; credits: number }]>([
    [{ tier: "PHONE_ONLY", quantity: 0, credits: 0 }],
    [{ tier: "PHONE_ONLY", quantity: 1000, credits: 1000 }],
    [{ tier: "PHONE_ONLY", quantity: 50000, credits: 50000 }],
    [{ tier: "VERIFIED_EMAIL", quantity: 0, credits: 0 }],
    [{ tier: "VERIFIED_EMAIL", quantity: 1000, credits: 2000 }],
    [{ tier: "VERIFIED_EMAIL", quantity: 50000, credits: 100000 }],
  ])(
    "calculates credit cost for $tier at $quantity leads",
    ({ tier, quantity, credits }) => {
      expect(getLeadCreditCost(quantity, tier)).toBe(credits);
      expect(
        LEAD_PACKAGES.find((pack) => pack.tier === tier)?.creditsPerLead,
      ).toBe(tier === "VERIFIED_EMAIL" ? 2 : 1);
    },
  );

  it.each(["PHONE_ONLY", "VERIFIED_EMAIL"] as const)(
    "renders %s with matching summary and guarantees",
    (tier) => {
      controls.tier = tier;
      const html = renderToStaticMarkup(createElement(LeadOrderEngine));
      const credits = tier === "PHONE_ONLY" ? "1,000" : "2,000";
      expect(html).toContain(`Unlock 1,000 Leads (${credits} Credits)`);
      expect(html).toContain('type="radio"');
      const selectedInput = html
        .match(/<input[^>]+>/g)
        ?.find((input) => input.includes(`value="${tier}"`));
      expect(selectedInput).toContain('checked=""');
      expect(html).toContain("Recommended");
      if (tier === "PHONE_ONLY") {
        expect(html).toContain("PHONE &amp; DIRECT DIALS (NO EMAIL)");
        expect(html).toContain("Not included");
        expect(html).not.toContain(
          "17 GUARANTEED FIELDS + 100% SMTP DELIVERABLE EMAIL",
        );
      } else {
        expect(html).toContain(
          "17 GUARANTEED FIELDS + 100% SMTP DELIVERABLE EMAIL",
        );
        expect(html).toContain("100% Deliverable");
      }
    },
  );

  it("loads credits only, without requesting inventory stats", () => {
    const html = renderToStaticMarkup(createElement(LeadOrderEngine));
    expect(controls.query).toHaveBeenCalledTimes(1);
    expect(controls.query.mock.calls[0][0]).toMatchObject({
      queryKey: ["user", "credits"],
    });
    expect(html).toContain("California");
    expect(html).not.toMatch(/>0 leads</);
  });

  it.each(["PHONE_ONLY", "VERIFIED_EMAIL"] as const)(
    "sends %s in the order payload",
    async (tier) => {
      controls.tier = tier;
      const checkout = checkoutCallback(LeadOrderEngine());
      expect(checkout).toBeTypeOf("function");
      await checkout!();
      expect(controls.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = controls.fetch.mock.calls[0];
      expect(url).toBe("/api/purchases/order");
      expect(JSON.parse(options.body)).toEqual({
        states: ["CA"],
        category: "real estate agents",
        quantity: 1000,
        tier,
      });
      expect(controls.push).toHaveBeenCalledWith("/dashboard/lists");
    },
  );
});

describe("lead package border and enriched checklist regressions", () => {
  it.each(["PHONE_ONLY", "VERIFIED_EMAIL"] as const)(
    "renders %s with exactly one selected-card border",
    (tier) => {
      controls.tier = tier;
      const html = renderToStaticMarkup(createElement(LeadOrderEngine));
      const cards = (html.match(/<label[^>]*>[\s\S]*?<\/label>/g) ?? []).filter(
        (card) => card.includes('name="lead-package"'),
      );
      expect(cards).toHaveLength(2);
      for (const card of cards) {
        const classes =
          card.match(/^<label[^>]*class="([^"]*)"/)?.[1].split(/\s+/) ?? [];
        expect(
          classes.some(
            (name) => name.includes("ring-") || name.includes("outline-"),
          ),
        ).toBe(false);
        if (card.includes(`value="${tier}"`)) {
          expect(classes).toEqual(
            expect.arrayContaining([
              "border-2",
              "border-blue-600",
              "bg-blue-50/20",
              "shadow-sm",
              "p-[15px]",
            ]),
          );
          expect(classes).not.toContain("border");
        } else {
          expect(classes).toEqual(
            expect.arrayContaining(["border", "border-slate-200", "p-4"]),
          );
          expect(classes).not.toContain("border-2");
        }
      }
    },
  );

  it.each(["PHONE_ONLY", "VERIFIED_EMAIL"] as const)(
    "keeps %s core fields and labels every bonus as optional",
    (tier) => {
      controls.tier = tier;
      const html = renderToStaticMarkup(createElement(LeadOrderEngine));
      const section = html.match(
        new RegExp(
          `<section[^>]*data-lead-tier="${tier}"[^>]*>[\\s\\S]*?</section>`,
        ),
      )?.[0];
      expect(section).toBeDefined();
      const core =
        section!.match(
          /<ul[^>]*aria-label="Core included fields"[^>]*>([\s\S]*?)<\/ul>/,
        )?.[1] ?? "";
      expect(core.match(/<li[ >]/g)).toHaveLength(
        tier === "VERIFIED_EMAIL" ? 17 : 14,
      );
      expect(core).toContain("Company Name");
      expect(core).toContain("Direct Phone Number");
      expect(core).toContain(
        tier === "PHONE_ONLY" ? "Google Maps Link" : "Live Google Maps Link",
      );
      if (tier === "PHONE_ONLY") {
        expect(core).toContain("Agent Name");
        expect(core).not.toContain("Timezone");
        expect(core).not.toContain("Data Source");
      }
      if (tier === "PHONE_ONLY") expect(core).not.toContain("Email");
      else expect(core).toContain("100% SMTP Deliverable Email");
      const bonus =
        section!.match(
          /<ul[^>]*aria-label="Optional bonus profiles"[^>]*>([\s\S]*?)<\/ul>/,
        )?.[1] ?? "";
      if (tier === "PHONE_ONLY") {
        expect(section).not.toContain("Bonus Enriched Profiles");
        expect(section).not.toContain("Optional bonus profiles");
        for (const label of [
          "LinkedIn",
          "Facebook",
          "Instagram",
          "WhatsApp",
          "Twitter",
        ])
          expect(section).not.toContain(label);
        return;
      }
      expect(bonus.match(/<li[ >]/g)).toHaveLength(5);
      expect(section).toContain("Bonus Enriched Profiles (if available)");
      for (const label of [
        "LinkedIn Profile (if available)",
        "Facebook Page (if available)",
        "Instagram (if available)",
        "WhatsApp Contact (if available)",
        "Twitter / X (if available)",
      ]) {
        expect(bonus).toContain(label);
      }
    },
  );
});
