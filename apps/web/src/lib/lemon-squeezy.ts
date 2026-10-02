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
  amount: number;
  userId: string;
  type?: string;
  email?: string;
  name?: string;
  redirectUrl: string;
  isPreview: boolean;
  unlockedStates?: any;
  credits?: number;
}

export async function createLemonSqueezyCheckout({
  storeId,
  variantId,
  amount,
  userId,
  type,
  email,
  name,
  redirectUrl,
  isPreview,
  unlockedStates,
  credits,
}: LemonSqueezyCheckoutParams): Promise<string> {
  const apiKey = getLemonSqueezyApiKey();
  if (!apiKey) {
    throw new Error("Lemon Squeezy API key is not configured");
  }

  const resolvedStoreId = storeId || getLemonSqueezyStoreId();
  const resolvedVariantId = variantId || getWalletTopupVariantId();

  if (!resolvedStoreId || !/^\d+$/.test(resolvedStoreId)) {
    console.warn("[LEMONSQUEEZY_VALIDATION] Invalid or missing LEMONSQUEEZY_STORE_ID:", resolvedStoreId);
    throw new Error("Lemon Squeezy store ID is not configured or invalid");
  }

  if (!resolvedVariantId || !/^\d+$/.test(resolvedVariantId)) {
    console.warn("[LEMONSQUEEZY_VALIDATION] Invalid or missing variant ID:", resolvedVariantId);
    throw new Error("Lemon Squeezy variant ID is not configured or invalid");
  }

  const checkoutData: Record<string, any> = {};
  if (email) checkoutData.email = email;
  if (name) checkoutData.name = name;
  checkoutData.custom = {
    user_id: String(userId),
    type: String(type || "WALLET_TOPUP"),
    amount: String(amount),
    ...(credits !== undefined ? { credits: String(credits) } : {}),
    ...(unlockedStates
      ? { unlocked_states: typeof unlockedStates === "string" ? unlockedStates : JSON.stringify(unlockedStates) }
      : {}),
  };

  const payload = {
    data: {
      type: "checkouts",
      attributes: {
        custom_price: Math.round(Number(amount) * 100),
        product_options: {
          enabled_variants: [Number(resolvedVariantId)],
        },
        checkout_data: checkoutData,
        preview: isPreview,
      },
      relationships: {
        store: {
          data: {
            type: "stores",
            id: String(resolvedStoreId),
          },
        },
        variant: {
          data: {
            type: "variants",
            id: String(resolvedVariantId),
          },
        },
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
    const error = await response.json().catch(() => ({}));
    console.error("[LEMONSQUEEZY_CHECKOUT_ERROR]:", JSON.stringify(error, null, 2));
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
