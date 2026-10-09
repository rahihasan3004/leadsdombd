import { NextResponse } from "next/server";
import { checkRateLimit } from "@fine-leads/utils";

/** Returns a 429 response if the key is over its limit, otherwise null. */
export function rateLimitOrNull(
  key: string,
  max: number,
  windowMs: number,
  message = "Too many requests. Please try again later."
): NextResponse | null {
  const { allowed, resetAt } = checkRateLimit(key, max, windowMs);
  if (allowed) return null;
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json({ error: message }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
}
