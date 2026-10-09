import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { get, setex, construct } = vi.hoisted(() => ({
  get: vi.fn(), setex: vi.fn(), construct: vi.fn(),
}));
// Resolve the SDK from its owning workspace package (pnpm does not hoist it into web).
vi.mock("../../../packages/utils/node_modules/@upstash/redis/nodejs.mjs", () => ({
  Redis: class {
    get = get;
    setex = setex;
    constructor(options: unknown) { construct(options); }
  },
}));
import { cachedAggregate } from "@fine-leads/utils/redis-cache";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://cache.test.upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@db.test/test");
  get.mockResolvedValue(null);
  setex.mockResolvedValue("OK");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("Upstash aggregate cache", () => {
  it("returns cached data without loading or rewriting", async () => {
    get.mockResolvedValue({ CA: 12 });
    const load = vi.fn();
    await expect(cachedAggregate("hit", 60, load)).resolves.toEqual({ CA: 12 });
    expect(load).not.toHaveBeenCalled();
    expect(setex).not.toHaveBeenCalled();
  });

  it("writes computed data with SETEX and a 60 second TTL", async () => {
    const load = vi.fn().mockResolvedValue({ CA: 24 });
    await expect(cachedAggregate("miss", 60, load)).resolves.toEqual({ CA: 24 });
    expect(setex).toHaveBeenCalledWith(expect.stringContaining(":miss"), 60, { CA: 24 });
    expect(load).toHaveBeenCalledOnce();
  });

  it("coalesces concurrent requests within an instance", async () => {
    let finish!: (value: { CA: number }) => void;
    const load = vi.fn(() => new Promise<{ CA: number }>((resolve) => { finish = resolve; }));
    const first = cachedAggregate("shared", 60, load);
    const second = cachedAggregate("shared", 60, load);
    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
    finish({ CA: 5 });
    expect(await Promise.all([first, second])).toEqual([{ CA: 5 }, { CA: 5 }]);
    expect(get).toHaveBeenCalledOnce();
  });

  it("falls back to the database when Redis reads fail", async () => {
    get.mockRejectedValue(new Error("Redis timeout"));
    const load = vi.fn().mockResolvedValue({ CA: 9 });
    await expect(cachedAggregate("offline", 60, load)).resolves.toEqual({ CA: 9 });
    expect(setex).not.toHaveBeenCalled();
  });

  it("returns database data even if the cache write fails", async () => {
    setex.mockRejectedValue(new Error("Redis unavailable"));
    await expect(cachedAggregate("write-fail", 60, async () => ({ CA: 9 }))).resolves.toEqual({ CA: 9 });
  });

  it("uses the database without network calls when Redis is not configured", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    await expect(cachedAggregate("local", 60, async () => ({ CA: 3 }))).resolves.toEqual({ CA: 3 });
    expect(get).not.toHaveBeenCalled();
  });

  it("does not cache failures and releases in-flight work for a retry", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("DB unavailable")).mockResolvedValueOnce({ CA: 1 });
    await expect(cachedAggregate("retry", 60, load)).rejects.toThrow("DB unavailable");
    expect(setex).not.toHaveBeenCalled();
    await expect(cachedAggregate("retry", 60, load)).resolves.toEqual({ CA: 1 });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("isolates cache keys by database", async () => {
    await cachedAggregate("scope", 60, async () => ({}));
    const firstKey = get.mock.calls[0][0];
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@other.test/test");
    await cachedAggregate("scope", 60, async () => ({}));
    expect(get.mock.calls[1][0]).not.toBe(firstKey);
    expect(firstKey).not.toContain("postgresql");
  });
});
