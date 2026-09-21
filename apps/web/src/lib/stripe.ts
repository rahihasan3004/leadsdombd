import Stripe from "stripe";

export function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured in environment.");
  }
  return new Stripe(key, { apiVersion: "2024-11-20.acacia" as any });
}