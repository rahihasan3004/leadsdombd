import { handlers } from "@fine-leads/auth";
import { checkRateLimit, getClientIp } from "@fine-leads/utils";
import { NextRequest, NextResponse } from "next/server";

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);
  const rateLimitKey = `login:${clientIp}`;
  const { allowed, remaining, resetAt } = checkRateLimit(rateLimitKey, MAX_LOGIN_ATTEMPTS, LOGIN_WINDOW_MS);

  if (!allowed) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  }

  const response = await handlers.POST(request);
  return response;
}

export const GET = handlers.GET;
