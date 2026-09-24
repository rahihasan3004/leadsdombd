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
