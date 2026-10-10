import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@fine-leads/auth", () => ({ auth: authMock }));

import { getCheckoutRedirectUrl } from "@/lib/checkout-url";
import { POST as recharge } from "../app/api/billing/recharge/route";
import { POST as checkout } from "../app/api/lemon-squeezy/checkout/route";

const fallback =
  "https://leadsdombd-web.vercel.app/dashboard/billing?status=success";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("checkout redirect URL", () => {
  it.each([
    ["https://leads.example.com", "https://leads.example.com"],
    ["  https://leads.example.com///  ", "https://leads.example.com"],
    [
      "https://leads.example.com/old/path?redirect=bad#fragment",
      "https://leads.example.com",
    ],
    ["http://localhost:3000/", "http://localhost:3000"],
  ])("normalizes configured app URL %s", (configured, origin) => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", configured);
    expect(getCheckoutRedirectUrl()).toBe(
      `${origin}/dashboard/billing?status=success`,
    );
  });

  it.each([
    undefined,
    "",
    "   ",
    "not-a-url",
    "//evil.example.com",
    "javascript:alert(1)",
    "ftp://leads.example.com",
    "https://user:password@leads.example.com",
    "https://leadsdomusa.vercel.app/dashboard/billing?status=success",
    "https://LEADSDOMUSA.vercel.app/",
  ])(
    "uses the production fallback for invalid or obsolete configuration %s",
    (configured) => {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", configured);
      expect(getCheckoutRedirectUrl()).toBe(fallback);
    },
  );

  it.each([
    ["wallet recharge", recharge, { type: "WALLET_TOPUP", tierId: "tier_500" }],
    [
      "lead checkout",
      checkout,
      { type: "LEAD_PURCHASE", states: ["TX"], quantity: 1000 },
    ],
  ] as const)(
    "sends the corrected fallback in the %s provider payload",
    async (_name, handler, body) => {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://leadsdomusa.vercel.app");
      authMock.mockResolvedValue({
        user: { id: "user_1", email: "user@example.com" },
      });
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              data: { attributes: { url: "https://pay.test/checkout" } },
            }),
            { status: 201 },
          ),
        );
      vi.stubGlobal("fetch", fetchMock);
      const response = await handler(
        new NextRequest(
          "https://leadsdombd-web.vercel.app/api/billing/recharge",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              origin: "https://attacker.example.com",
              "x-forwarded-host": "attacker.example.com",
            },
            body: JSON.stringify(body),
          },
        ),
      );
      expect(response.status).toBe(200);
      const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
      expect(payload.data.attributes.product_options.redirect_url).toBe(
        fallback,
      );
    },
  );
});
