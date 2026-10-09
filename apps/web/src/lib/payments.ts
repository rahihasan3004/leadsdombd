import crypto from "crypto";
import { z } from "zod";
import {
  US_STATES,
  calculateLeadPrice,
  findTierById,
  VOLUME_PRICING_TIERS,
} from "@fine-leads/utils";

/**
 * Server-authoritative pricing for Lemon Squeezy checkouts.
 * The client only sends *what* it wants (tierId, or states + quantity);
 * price and credits are always derived here and signed into the checkout
 * custom data so the webhook can verify them.
 */

export const LEAD_PURCHASE_MIN_QUANTITY = 100;
export const LEAD_PURCHASE_MAX_QUANTITY = 100_000;
const MIN_CHECKOUT_CENTS = 50;

const VALID_STATE_CODES: ReadonlySet<string> = new Set(US_STATES.map((s) => s.code));
const TIER_IDS = VOLUME_PRICING_TIERS.map((t) => t.id) as [string, ...string[]];

/** Validates, upper-cases, de-duplicates and sorts US state codes. */
export const stateCodesSchema = z
  .array(z.string().trim().toUpperCase())
  .min(1, "Select at least one state")
  .max(VALID_STATE_CODES.size)
  .refine((codes) => codes.every((c) => VALID_STATE_CODES.has(c)), {
    message: "Invalid state code",
  })
  .transform((codes) => Array.from(new Set(codes)).sort());

export const checkoutRequestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("WALLET_TOPUP"),
    tierId: z.enum(TIER_IDS),
  }),
  z.object({
    type: z.literal("LEAD_PURCHASE"),
    states: stateCodesSchema,
    quantity: z
      .number()
      .int()
      .min(LEAD_PURCHASE_MIN_QUANTITY)
      .max(LEAD_PURCHASE_MAX_QUANTITY),
  }),
]);

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

export type PricedOrder =
  | {
      type: "WALLET_TOPUP";
      tierId: string;
      credits: number;
      amountCents: number;
    }
  | {
      type: "LEAD_PURCHASE";
      states: string[];
      quantity: number;
      amountCents: number;
    };

export class PricingError extends Error {}

/** Resolves the canonical price for a validated request. */
export function priceOrder(request: CheckoutRequest): PricedOrder {
  if (request.type === "WALLET_TOPUP") {
    const tier = findTierById(request.tierId);
    if (!tier) throw new PricingError("Unknown pricing tier");
    return {
      type: "WALLET_TOPUP",
      tierId: tier.id,
      credits: tier.credits,
      amountCents: Math.round(tier.price * 100),
    };
  }

  const amountCents = Math.round(calculateLeadPrice(request.quantity) * 100);
  if (amountCents < MIN_CHECKOUT_CENTS) throw new PricingError("Order total too low");
  return {
    type: "LEAD_PURCHASE",
    states: request.states,
    quantity: request.quantity,
    amountCents,
  };
}

/* ------------------------------------------------------------------ */
/* Signed checkout custom data                                         */
/* ------------------------------------------------------------------ */

export type CheckoutCustomData = Record<string, string>;

function getSigningKey(): string {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error("LEMONSQUEEZY_WEBHOOK_SECRET is not configured");
  // Domain-separated so the raw webhook secret is never reused directly.
  return crypto.createHmac("sha256", secret).update("leadsdom:checkout-custom-data:v1").digest("hex");
}

function canonicalPayload(userId: string, order: PricedOrder): string {
  return order.type === "WALLET_TOPUP"
    ? ["v1", userId, order.type, order.tierId, order.credits, order.amountCents].join("|")
    : ["v1", userId, order.type, order.states.join(","), order.quantity, order.amountCents].join("|");
}

function sign(userId: string, order: PricedOrder): string {
  return crypto.createHmac("sha256", getSigningKey()).update(canonicalPayload(userId, order)).digest("hex");
}

export function buildCheckoutCustomData(userId: string, order: PricedOrder): CheckoutCustomData {
  const base: CheckoutCustomData = {
    user_id: userId,
    type: order.type,
    amount_cents: String(order.amountCents),
    sig: sign(userId, order),
  };
  return order.type === "WALLET_TOPUP"
    ? { ...base, tier_id: order.tierId, credits: String(order.credits) }
    : { ...base, states: order.states.join(","), quantity: String(order.quantity) };
}

function safeEqualHex(a: string, b: string): boolean {
  if (!/^[0-9a-f]+$/i.test(a) || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

const customDataSchema = z.object({
  user_id: z.string().min(1),
  type: z.enum(["WALLET_TOPUP", "LEAD_PURCHASE"]),
  sig: z.string().min(1),
  tier_id: z.string().optional(),
  states: z.string().optional(),
  quantity: z.string().optional(),
});

/**
 * Re-derives the order from the webhook custom data using server pricing and
 * checks the HMAC. Returns null if anything was tampered with or is unknown.
 */
export function verifyCheckoutCustomData(
  raw: unknown
): { userId: string; order: PricedOrder } | null {
  const parsed = customDataSchema.safeParse(raw);
  if (!parsed.success) return null;
  const data = parsed.data;

  let request: CheckoutRequest;
  if (data.type === "WALLET_TOPUP") {
    const result = checkoutRequestSchema.safeParse({ type: data.type, tierId: data.tier_id });
    if (!result.success) return null;
    request = result.data;
  } else {
    const result = checkoutRequestSchema.safeParse({
      type: data.type,
      states: (data.states ?? "").split(",").filter(Boolean),
      quantity: Number(data.quantity),
    });
    if (!result.success) return null;
    request = result.data;
  }

  let order: PricedOrder;
  try {
    order = priceOrder(request);
  } catch {
    return null;
  }

  if (!safeEqualHex(data.sig, sign(data.user_id, order))) return null;
  return { userId: data.user_id, order };
}
