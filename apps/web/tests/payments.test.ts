import { describe, expect, it } from "vitest";
import {
  buildCheckoutCustomData,
  checkoutRequestSchema,
  priceOrder,
  stateCodesSchema,
  verifyCheckoutCustomData,
} from "@/lib/payments";

describe("priceOrder", () => {
  it("prices wallet top-ups strictly from VOLUME_PRICING_TIERS", () => {
    const order = priceOrder({ type: "WALLET_TOPUP", tierId: "tier_10k" });
    expect(order).toEqual({ type: "WALLET_TOPUP", tierId: "tier_10k", credits: 10000, amountCents: 17000 });
  });

  it("prices lead purchases from quantity on the server", () => {
    const order = priceOrder({ type: "LEAD_PURCHASE", states: ["CA", "TX"], quantity: 1000 });
    expect(order).toMatchObject({ type: "LEAD_PURCHASE", quantity: 1000, amountCents: 1900 });
  });
});

describe("checkoutRequestSchema", () => {
  it("strips client-supplied amount/credits", () => {
    const parsed = checkoutRequestSchema.parse({ type: "WALLET_TOPUP", tierId: "tier_500", amount: 1, credits: 1_000_000 });
    expect(parsed).toEqual({ type: "WALLET_TOPUP", tierId: "tier_500" });
  });

  it("rejects unknown tiers and legacy amount-only bodies", () => {
    expect(checkoutRequestSchema.safeParse({ type: "WALLET_TOPUP", tierId: "tier_free" }).success).toBe(false);
    expect(checkoutRequestSchema.safeParse({ amount: 1, credits: 50000 }).success).toBe(false);
  });

  it("enforces lead quantity bounds", () => {
    expect(checkoutRequestSchema.safeParse({ type: "LEAD_PURCHASE", states: ["CA"], quantity: 99 }).success).toBe(false);
    expect(checkoutRequestSchema.safeParse({ type: "LEAD_PURCHASE", states: ["CA"], quantity: 100_001 }).success).toBe(false);
    expect(checkoutRequestSchema.safeParse({ type: "LEAD_PURCHASE", states: ["CA"], quantity: 10.5 }).success).toBe(false);
  });
});

describe("stateCodesSchema", () => {
  it("normalizes, de-duplicates and sorts", () => {
    expect(stateCodesSchema.parse([" tx", "ca", "CA"])).toEqual(["CA", "TX"]);
  });

  it("rejects unknown codes, non-strings and empty lists", () => {
    expect(stateCodesSchema.safeParse(["CA", "ZZ"]).success).toBe(false);
    expect(stateCodesSchema.safeParse(["CA", 42]).success).toBe(false);
    expect(stateCodesSchema.safeParse([]).success).toBe(false);
    expect(stateCodesSchema.safeParse("CA").success).toBe(false);
  });
});

describe("signed checkout custom data", () => {
  const topup = priceOrder({ type: "WALLET_TOPUP", tierId: "tier_500" });

  it("round-trips a valid signature", () => {
    const custom = buildCheckoutCustomData("user_1", topup);
    expect(verifyCheckoutCustomData(custom)).toEqual({ userId: "user_1", order: topup });
  });

  it("re-derives credits from the tier, ignoring a tampered credits field", () => {
    const custom = { ...buildCheckoutCustomData("user_1", topup), credits: "50000" };
    expect(verifyCheckoutCustomData(custom)?.order).toEqual(topup);
  });

  it("rejects a tampered tier, user or signature", () => {
    const custom = buildCheckoutCustomData("user_1", topup);
    expect(verifyCheckoutCustomData({ ...custom, tier_id: "tier_50k" })).toBeNull();
    expect(verifyCheckoutCustomData({ ...custom, user_id: "attacker" })).toBeNull();
    expect(verifyCheckoutCustomData({ ...custom, sig: "00".repeat(32) })).toBeNull();
    expect(verifyCheckoutCustomData({ ...custom, sig: "not-hex" })).toBeNull();
  });

  it("rejects tampered lead purchase states/quantity", () => {
    const lead = priceOrder({ type: "LEAD_PURCHASE", states: ["CA"], quantity: 1000 });
    const custom = buildCheckoutCustomData("user_1", lead);
    expect(verifyCheckoutCustomData(custom)?.order).toEqual(lead);
    expect(verifyCheckoutCustomData({ ...custom, states: "CA,NY,TX" })).toBeNull();
    expect(verifyCheckoutCustomData({ ...custom, quantity: "100000" })).toBeNull();
  });

  it("rejects missing or malformed custom data", () => {
    expect(verifyCheckoutCustomData(undefined)).toBeNull();
    expect(verifyCheckoutCustomData({ user_id: "u", type: "WALLET_TOPUP" })).toBeNull();
  });
});
