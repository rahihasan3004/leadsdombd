import { NextResponse } from "next/server";
import { checkRateLimit } from "@fine-leads/utils/rate-limit";

/** Returns a 429 response if the key is over its limit, otherwise null. */
export async function rateLimitOrNull(
  key: string,
  max: number,
  windowMs: number,
  message = "Too many requests. Please try again later."
): Promise<NextResponse | null> {
  const { allowed, resetAt } = await checkRateLimit(key, max, windowMs);
  if (allowed) return null;
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json({ error: message }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
}
