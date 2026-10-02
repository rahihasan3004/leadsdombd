export function getLemonSqueezyApiKey(): string {
  return process.env.LEMONSQUEEZY_API_KEY || "";
}

export function getLemonSqueezyStoreId(): string {
  return process.env.LEMONSQUEEZY_STORE_ID || process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_ID || "";
}

export function getLemonSqueezyWebhookSecret(): string {
  return process.env.LEMONSQUEEZY_WEBHOOK_SECRET || "";
}

export function getWalletTopupVariantId(): string {
  return process.env.LEMONSQUEEZY_WALLET_TOPUP_VARIANT_ID || "";
}

export function getLeadPurchaseVariantId(): string {
  return process.env.LEMONSQUEEZY_LEAD_PURCHASE_VARIANT_ID || "";
}

export const LEMON_SQUEEZY_API_KEY = process.env.LEMONSQUEEZY_API_KEY;
export const LEMON_SQUEEZY_STORE_ID = process.env.LEMONSQUEEZY_STORE_ID;
export const LEMON_SQUEEZY_WEBHOOK_SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
export const LEMON_SQUEEZY_WALLET_TOPUP_VARIANT_ID = process.env.LEMONSQUEEZY_WALLET_TOPUP_VARIANT_ID;
export const LEMON_SQUEEZY_LEAD_PURCHASE_VARIANT_ID = process.env.LEMONSQUEEZY_LEAD_PURCHASE_VARIANT_ID;

export interface LemonSqueezyCheckoutParams {
  storeId: string;
  variantId: string;
  amountInCents: number;
  email?: string;
  name?: string;
  custom: Record<string, any>;
  redirectUrl: string;
  isPreview: boolean;
}

export async function createLemonSqueezyCheckout({
  storeId,
  variantId,
  amountInCents,
  email,
  name,
  custom,
  redirectUrl,
  isPreview,
}: LemonSqueezyCheckoutParams): Promise<string> {
  const apiKey = getLemonSqueezyApiKey();
  if (!apiKey) {
    throw new Error("Lemon Squeezy API key is not configured");
  }

  const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/vnd.api+json",
      Accept: "application/vnd.api+json",
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          custom_price: amountInCents,
          checkout_data: {
            email: email || undefined,
            name: name || undefined,
            custom,
            redirect_url: redirectUrl,
          },
          preview: isPreview,
        },
        relationships: {
          store: {
            data: {
              type: "stores",
              id: storeId,
            },
          },
          variant: {
            data: {
              type: "variants",
              id: variantId,
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message = error.errors?.[0]?.detail || error.error || `Lemon Squeezy error: ${response.status}`;
    throw new Error(message);
  }

  const data = await response.json();
  const checkoutUrl = data.data?.attributes?.url;
  if (!checkoutUrl) {
    throw new Error("Lemon Squeezy did not return a checkout URL");
  }

  return checkoutUrl;
}
