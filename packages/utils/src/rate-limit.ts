/**
 * Server-only rate limiting. Import from "@fine-leads/utils/rate-limit" (NOT the
 * package barrel) so @upstash/* never ends up in client bundles.
 *
 * Backend selection (per call, so env changes in tests are respected):
 *  - UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN set -> Upstash Redis
 *    (fixed window, shared across all instances / serverless invocations).
 *  - Otherwise -> in-memory fixed window (per process; fine for local dev/tests).
 *  - If Redis errors or exceeds REDIS_TIMEOUT_MS, the call falls back to the
 *    in-memory limiter so a Redis outage degrades protection instead of
 *    disabling it (or taking auth endpoints down).
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getClientIp } from "./client-ip";

export { getClientIp };

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  key?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Epoch ms when the current window resets. */
  resetAt: number;
}

export interface RateLimitBackend {
  readonly name: string;
  limit(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult>;
}

const KEY_PREFIX = "fine-leads:rl";
const REDIS_TIMEOUT_MS = 1500;
const MEMORY_SWEEP_THRESHOLD = 10_000;

// ---------------------------------------------------------------------------
// In-memory backend
// ---------------------------------------------------------------------------

type MemoryRecord = { count: number; resetAt: number };
const memoryStore = new Map<string, MemoryRecord>();

function sweepExpired(now: number) {
  for (const [key, record] of memoryStore) {
    if (now >= record.resetAt) memoryStore.delete(key);
  }
}

/** Synchronous in-memory fixed-window limiter (per process). */
export function checkRateLimitMemory(key: string, maxRequests: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (memoryStore.size > MEMORY_SWEEP_THRESHOLD) sweepExpired(now);

  const record = memoryStore.get(key);
  if (!record || now >= record.resetAt) {
    const resetAt = now + windowMs;
    memoryStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: Math.max(0, maxRequests - 1), resetAt };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count += 1;
  return { allowed: true, remaining: maxRequests - record.count, resetAt: record.resetAt };
}

export const memoryBackend: RateLimitBackend = {
  name: "memory",
  limit: async (key, maxRequests, windowMs) => checkRateLimitMemory(key, maxRequests, windowMs),
};

// ---------------------------------------------------------------------------
// Upstash backend
// ---------------------------------------------------------------------------

export function createUpstashBackend(url: string, token: string): RateLimitBackend {
  // Fail fast; we fall back to memory on error rather than retrying for seconds.
  const redis = new Redis({ url, token, retry: { retries: 1 } });
  // One Ratelimit per (max, window) pair; keys are namespaced by the caller.
  const limiters = new Map<string, Ratelimit>();

  const getLimiter = (maxRequests: number, windowMs: number) => {
    const id = `${maxRequests}:${windowMs}`;
    let limiter = limiters.get(id);
    if (!limiter) {
      limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.fixedWindow(maxRequests, `${windowMs} ms`),
        prefix: `${KEY_PREFIX}:${id}`,
        analytics: false,
        // 0 disables the library's fail-open timeout; we handle timeouts ourselves.
        timeout: 0,
      });
      limiters.set(id, limiter);
    }
    return limiter;
  };

  return {
    name: "upstash",
    async limit(key, maxRequests, windowMs) {
      const { success, remaining, reset } = await getLimiter(maxRequests, windowMs).limit(key);
      return { allowed: success, remaining: Math.max(0, remaining), resetAt: reset };
    },
  };
}

// ---------------------------------------------------------------------------
// Backend resolution
// ---------------------------------------------------------------------------

let backendOverride: RateLimitBackend | null = null;
let upstashBackend: { url: string; token: string; backend: RateLimitBackend } | null = null;
let warnedMissingEnv = false;

/** Test hook: force a backend (pass null to restore env-based selection). */
export function setRateLimitBackend(backend: RateLimitBackend | null): void {
  backendOverride = backend;
}

/** Test hook: clear in-memory counters and cached clients. */
export function resetRateLimitState(): void {
  memoryStore.clear();
  upstashBackend = null;
  warnedMissingEnv = false;
}

export function getRateLimitBackend(): RateLimitBackend {
  if (backendOverride) return backendOverride;

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url && token) {
    if (!upstashBackend || upstashBackend.url !== url || upstashBackend.token !== token) {
      upstashBackend = { url, token, backend: createUpstashBackend(url, token) };
    }
    return upstashBackend.backend;
  }

  if (process.env.NODE_ENV === "production" && !warnedMissingEnv) {
    warnedMissingEnv = true;
    console.warn(
      "[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN not set; using per-instance in-memory rate limiting.",
    );
  }
  return memoryBackend;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`rate limit backend timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Count one request against `key` and report whether it is allowed.
 * Never throws: backend failures fall back to the in-memory limiter.
 */
export async function checkRateLimit(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult> {
  const backend = getRateLimitBackend();
  if (backend === memoryBackend) return checkRateLimitMemory(key, maxRequests, windowMs);

  try {
    return await withTimeout(backend.limit(key, maxRequests, windowMs), REDIS_TIMEOUT_MS);
  } catch (error) {
    console.error(`[rate-limit] ${backend.name} backend failed; falling back to memory`, error);
    return checkRateLimitMemory(key, maxRequests, windowMs);
  }
}

export function createRateLimiter(options: RateLimitOptions) {
  const { maxRequests, windowMs, key } = options;
  return (request: Request): Promise<RateLimitResult> => {
    const clientKey = key ? `${key}:${getClientIp(request)}` : getClientIp(request);
    return checkRateLimit(clientKey, maxRequests, windowMs);
  };
}
