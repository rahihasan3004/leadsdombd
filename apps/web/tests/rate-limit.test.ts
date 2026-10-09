import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkRateLimit,
  getRateLimitBackend,
  memoryBackend,
  resetRateLimitState,
  setRateLimitBackend,
  type RateLimitBackend,
} from "@fine-leads/utils/rate-limit";
import { rateLimitOrNull } from "@/lib/rate-limit-response";

// No network: Upstash is only ever *constructed* here, never called.
const WINDOW = 60_000;

function clearUpstashEnv() {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
}

beforeEach(() => {
  clearUpstashEnv();
  setRateLimitBackend(null);
  resetRateLimitState();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  clearUpstashEnv();
  setRateLimitBackend(null);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("rate limit backend selection", () => {
  it("uses in-memory limiting when Upstash env vars are missing", () => {
    expect(getRateLimitBackend()).toBe(memoryBackend);
  });

  it("uses in-memory limiting when only one Upstash env var is set", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    expect(getRateLimitBackend()).toBe(memoryBackend);
  });

  it("selects Upstash when both env vars are set (and reuses the client)", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    const backend = getRateLimitBackend();
    expect(backend.name).toBe("upstash");
    expect(getRateLimitBackend()).toBe(backend);
  });
});

describe("in-memory fixed window", () => {
  it("allows up to the limit, then blocks until the window resets", async () => {
    vi.useFakeTimers();
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await checkRateLimit("k", 3, WINDOW));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results.map((r) => r.remaining)).toEqual([2, 1, 0, 0]);

    vi.advanceTimersByTime(WINDOW);
    expect((await checkRateLimit("k", 3, WINDOW)).allowed).toBe(true);
  });

  it("tracks keys independently", async () => {
    await checkRateLimit("a", 1, WINDOW);
    expect((await checkRateLimit("a", 1, WINDOW)).allowed).toBe(false);
    expect((await checkRateLimit("b", 1, WINDOW)).allowed).toBe(true);
  });
});

describe("remote backend", () => {
  it("returns the backend's decision", async () => {
    const limit = vi.fn<RateLimitBackend["limit"]>().mockResolvedValue({ allowed: false, remaining: 0, resetAt: 123 });
    setRateLimitBackend({ name: "fake", limit });
    await expect(checkRateLimit("k", 5, WINDOW)).resolves.toEqual({ allowed: false, remaining: 0, resetAt: 123 });
    expect(limit).toHaveBeenCalledWith("k", 5, WINDOW);
  });

  it("falls back to memory (still enforcing limits) when the backend throws", async () => {
    setRateLimitBackend({ name: "broken", limit: () => Promise.reject(new Error("ECONNREFUSED")) });
    expect((await checkRateLimit("k", 1, WINDOW)).allowed).toBe(true);
    expect((await checkRateLimit("k", 1, WINDOW)).allowed).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  it("falls back to memory when the backend hangs past the timeout", async () => {
    vi.useFakeTimers();
    setRateLimitBackend({ name: "hung", limit: () => new Promise(() => {}) });
    const pending = checkRateLimit("k", 2, WINDOW);
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(pending).resolves.toMatchObject({ allowed: true, remaining: 1 });
  });
});

describe("rateLimitOrNull", () => {
  it("returns null while under the limit and a 429 with Retry-After once exceeded", async () => {
    expect(await rateLimitOrNull("route", 1, WINDOW)).toBeNull();
    const res = await rateLimitOrNull("route", 1, WINDOW, "Slow down");
    expect(res?.status).toBe(429);
    expect(Number(res?.headers.get("Retry-After"))).toBeGreaterThan(0);
    await expect(res?.json()).resolves.toEqual({ error: "Slow down" });
  });
});
