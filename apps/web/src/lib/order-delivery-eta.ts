export function orderDeliveryEta(quantity: number): string {
  if (quantity <= 20) return "Est. 1–2 mins";
  if (quantity <= 100) return "Est. 3–5 mins";
  if (quantity <= 500) return "Est. 8–15 mins";
  return "Est. 15–30 mins";
}
export const ORDER_DELIVERY_HELP =
  "Your order is actively being gathered. You will receive an email confirmation once completed.";
