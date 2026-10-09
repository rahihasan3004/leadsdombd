import type { CheckoutCustomData } from "@/lib/payments";

export function getLemonSqueezyApiKey(): string {
  return process.env.LEMONSQUEEZY_API_KEY || "";
}

export function getLemonSqueezyStoreId(): string {
  return process.env.LEMONSQUEEZY_STORE_ID || process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_ID || "";
}

/** Returns the webhook signing secret, or an empty string if not configured. Never falls back. */
export function getLemonSqueezyWebhookSecret(): string {
  return (process.env.LEMONSQUEEZY_WEBHOOK_SECRET || "").trim();
}

export function getWalletTopupVariantId(): string {
  return process.env.LEMONSQUEEZY_WALLET_TOPUP_VARIANT_ID || "";
}

export function getLeadPurchaseVariantId(): string {
  return process.env.LEMONSQUEEZY_LEAD_PURCHASE_VARIANT_ID || "";
}

export interface LemonSqueezyCheckoutParams {
  storeId: string;
  variantId: string;
  /** Server-computed price in cents. */
  amountCents: number;
  /** Server-built, signed custom data (see buildCheckoutCustomData). */
  customData: CheckoutCustomData;
  email?: string;
  name?: string;
  redirectUrl: string;
  isPreview: boolean;
}

interface LemonSqueezyErrorBody {
  errors?: Array<{ detail?: string }>;
  error?: string;
}

interface LemonSqueezyCheckoutResponse {
  data?: { attributes?: { url?: string } };
}

export async function createLemonSqueezyCheckout({
  storeId,
  variantId,
  amountCents,
  customData,
  email,
  name,
  redirectUrl,
  isPreview,
}: LemonSqueezyCheckoutParams): Promise<string> {
  const apiKey = getLemonSqueezyApiKey();
  if (!apiKey) {
    throw new Error("Lemon Squeezy API key is not configured");
  }

  if (!/^\d+$/.test(storeId)) {
    throw new Error("Lemon Squeezy store ID is not configured or invalid");
  }
  if (!/^\d+$/.test(variantId)) {
    throw new Error("Lemon Squeezy variant ID is not configured or invalid");
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("Invalid checkout amount");
  }

  const payload = {
    data: {
      type: "checkouts",
      attributes: {
        custom_price: amountCents,
        product_options: {
          enabled_variants: [Number(variantId)],
          redirect_url: redirectUrl,
        },
        checkout_data: {
          ...(email ? { email } : {}),
          ...(name ? { name } : {}),
          custom: customData,
        },
        preview: isPreview,
      },
      relationships: {
        store: { data: { type: "stores", id: storeId } },
        variant: { data: { type: "variants", id: variantId } },
      },
    },
  };

  const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as LemonSqueezyErrorBody;
    console.error("[LEMONSQUEEZY_CHECKOUT_ERROR]:", JSON.stringify(error));
    throw new Error(error.errors?.[0]?.detail || error.error || `Lemon Squeezy error: ${response.status}`);
  }

  const data = (await response.json()) as LemonSqueezyCheckoutResponse;
  const checkoutUrl = data.data?.attributes?.url;
  if (!checkoutUrl) {
    throw new Error("Lemon Squeezy did not return a checkout URL");
  }
  return checkoutUrl;
}
