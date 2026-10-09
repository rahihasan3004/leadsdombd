// Deterministic test configuration. No real network or database is used.
process.env.AUTH_SECRET = "test-auth-secret-0123456789abcdef0123456789";
process.env.LEMONSQUEEZY_WEBHOOK_SECRET = "whsec_test_0123456789abcdef";
process.env.LEMONSQUEEZY_API_KEY = "test_api_key";
process.env.LEMONSQUEEZY_STORE_ID = "123";
process.env.LEMONSQUEEZY_WALLET_TOPUP_VARIANT_ID = "456";
process.env.LEMONSQUEEZY_LEAD_PURCHASE_VARIANT_ID = "789";
process.env.NEXT_PUBLIC_APP_URL = "https://app.test";
