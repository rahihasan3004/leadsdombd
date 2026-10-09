/** Server-only: import the subpath, never the client-facing utils barrel. */
import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";

let client: { url: string; token: string; redis: Redis } | undefined;
const inFlight = new Map<string, Promise<unknown>>();

function getRedis(): Redis | undefined {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return undefined;
  if (!client || client.url !== url || client.token !== token) {
    client = { url, token, redis: new Redis({
      url,
      token,
      retry: { retries: 0 },
      // A fresh abort signal per command prevents a Redis outage adding seconds.
      signal: () => AbortSignal.timeout(200),
    }) };
  }
  return client.redis;
}

/** Cache public aggregates only, never sessions, permissions, credits or lead details. */
export async function cachedAggregate<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  // Isolate previews/other databases sharing the same Redis without exposing credentials.
  const scope = createHash("sha256").update(process.env.DATABASE_URL ?? "local").digest("hex").slice(0, 16);
  const cacheKey = `fine-leads:aggregate:${scope}:${key}`;
  const pending = inFlight.get(cacheKey);
  if (pending) return pending as Promise<T>;

  const work = (async () => {
    let redis: Redis | undefined;
    try {
      redis = getRedis();
      if (redis) {
        const cached = await redis.get<T>(cacheKey);
        if (cached !== null) return cached;
      }
    } catch (error) {
      // Fall back to Postgres; skip the write if the read already failed/timed out.
      redis = undefined;
      console.warn("[AGGREGATE_CACHE_READ_FAILED]", error instanceof Error ? error.name : "RedisError");
    }
    const value = await load();
    if (redis) {
      try {
        await redis.setex(cacheKey, ttlSeconds, value);
      } catch (error) {
        console.warn("[AGGREGATE_CACHE_WRITE_FAILED]", error instanceof Error ? error.name : "RedisError");
      }
    }
    return value;
  })();
  inFlight.set(cacheKey, work);
  try {
    return await work;
  } finally {
    inFlight.delete(cacheKey);
  }
}
