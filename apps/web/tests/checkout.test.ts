import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@fine-leads/auth", () => ({ auth: authMock }));

import { POST as recharge } from "../app/api/billing/recharge/route";
import { POST as lemonCheckout } from "../app/api/lemon-squeezy/checkout/route";
import { verifyCheckoutCustomData } from "@/lib/payments";

interface CheckoutPayload {
  data: {
    attributes: {
      custom_price: number;
      checkout_data: { custom: Record<string, string> };
      product_options: { enabled_variants: number[]; redirect_url: string };
    };
  };
}

const fetchMock = vi.fn();

function request(body: unknown): NextRequest {
  return new NextRequest("https://app.test/api/billing/recharge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function sentPayload(): CheckoutPayload {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body)) as CheckoutPayload;
}

beforeEach(() => {
  authMock.mockResolvedValue({ user: { id: "user_1", email: "u@test.dev", name: "U" } });
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ data: { attributes: { url: "https://pay.test/checkout/abc" } } }), { status: 201 }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

describe("POST /api/billing/recharge", () => {
  it.each([
    ["tier_500", 500, 1500],
    ["tier_1k", 1000, 2500],
    ["tier_2k", 2000, 3900],
    ["tier_10k", 10000, 16900],
    ["tier_30k", 30000, 44900],
    ["tier_50k", 50000, 64900],
  ])("charges the canonical price for %s", async (tierId, credits, amountCents) => {
    const res = await recharge(request({ type: "WALLET_TOPUP", tierId, amount: 1, credits: 999999 }));
    expect(res.status).toBe(200);
    const { attributes } = sentPayload().data;
    expect(attributes.custom_price).toBe(amountCents);
    expect(verifyCheckoutCustomData(attributes.checkout_data.custom)?.order).toMatchObject({ tierId, credits, amountCents });
  });

  it("rejects unauthenticated requests", async () => {
    authMock.mockResolvedValue(null);
    const res = await recharge(request({ type: "WALLET_TOPUP", tierId: "tier_500" }));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores client amount/credits and charges the server tier price", async () => {
    const res = await recharge(request({ type: "WALLET_TOPUP", tierId: "tier_1k", amount: 1, credits: 999_999 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://pay.test/checkout/abc" });

    const { attributes } = sentPayload().data;
    expect(attributes.custom_price).toBe(2500);
    expect(attributes.product_options.enabled_variants).toEqual([456]);
    expect(attributes.product_options.redirect_url).toBe("https://app.test/dashboard/billing?status=success");
    expect(attributes.checkout_data.custom).toMatchObject({ user_id: "user_1", tier_id: "tier_1k", credits: "1000" });

    const verified = verifyCheckoutCustomData(attributes.checkout_data.custom);
    expect(verified).toMatchObject({ userId: "user_1", order: { credits: 1000, amountCents: 2500 } });
  });

  it("rejects legacy amount/credits bodies and unknown tiers", async () => {
    expect((await recharge(request({ amount: 1, credits: 1_000_000 }))).status).toBe(400);
    expect((await recharge(request({ type: "WALLET_TOPUP", tierId: "tier_999" }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 500 without leaking upstream errors", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ errors: [{ detail: "secret upstream detail" }] }), { status: 422 }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await recharge(request({ type: "WALLET_TOPUP", tierId: "tier_500" }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret upstream detail");
  });
});

describe("POST /api/lemon-squeezy/checkout (lead purchase)", () => {
  it("prices states + quantity on the server and normalizes states", async () => {
    const res = await lemonCheckout(request({ type: "LEAD_PURCHASE", states: ["tx", "ca", "CA"], quantity: 1000, amount: 0.01 }));
    expect(res.status).toBe(200);

    const { attributes } = sentPayload().data;
    expect(attributes.custom_price).toBe(1900);
    expect(attributes.product_options.enabled_variants).toEqual([789]);
    expect(attributes.checkout_data.custom).toMatchObject({ type: "LEAD_PURCHASE", states: "CA,TX", quantity: "1000" });
  });

  it("rejects invalid state codes", async () => {
    const res = await lemonCheckout(request({ type: "LEAD_PURCHASE", states: ["CA", "XX"], quantity: 1000 }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
