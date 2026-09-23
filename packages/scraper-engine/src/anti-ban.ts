import http from "node:http";
import https from "node:https";
import zlib from "node:zlib";
import { URL } from "node:url";
import { getEnv, type ScraperEnv } from "./config/env.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol?: "http" | "https";
}

interface ProxyEntry {
  config: ProxyConfig;
  healthy: boolean;
  failCount: number;
  lastUsed: number;
  lastCheck: number;
}

export interface FetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
}

export interface RequestConfig {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  signal?: AbortSignal;
}

export interface ResilientRequestConfig extends RequestConfig {
  retryMaxAttempts?: number;
  retryBackoffMs?: number;
}

export interface RateLimiter {
  acquire(): Promise<void>;
  release(): void;
}

// ---------------------------------------------------------------------------
// Proxy Pool
// ---------------------------------------------------------------------------

export class ProxyPool {
  private proxies: ProxyEntry[];
  private currentIndex = 0;
  private maxFails: number;

  constructor(proxies: ProxyConfig[], maxFails = 3) {
    if (proxies.length === 0) {
      this.proxies = [{ config: { host: "", port: 0 }, healthy: true, failCount: 0, lastUsed: 0, lastCheck: Date.now() }];
    } else {
      this.proxies = proxies.map((p) => ({
        config: p,
        healthy: true,
        failCount: 0,
        lastUsed: 0,
        lastCheck: Date.now(),
      }));
    }
    this.maxFails = maxFails;
  }

  getProxy(): ProxyConfig | null {
    const healthy = this.proxies.filter((p) => p.healthy);
    if (healthy.length === 0) {
      this.resetAll();
      const retry = this.proxies.filter((p) => p.healthy);
      if (retry.length === 0) return null;
      return this.pickNext(retry);
    }
    return this.pickNext(healthy);
  }

  markSuccess(config: ProxyConfig): void {
    const entry = this.proxies.find(
      (p) => p.config.host === config.host && p.config.port === config.port
    );
    if (entry) {
      entry.healthy = true;
      entry.failCount = 0;
      entry.lastUsed = Date.now();
    }
  }

  markFailed(config: ProxyConfig): void {
    const entry = this.proxies.find(
      (p) => p.config.host === config.host && p.config.port === config.port
    );
    if (entry) {
      entry.failCount++;
      entry.lastCheck = Date.now();
      if (entry.failCount >= this.maxFails) {
        entry.healthy = false;
      }
    }
  }

  stats(): { total: number; healthy: number; failed: number } {
    return {
      total: this.proxies.length,
      healthy: this.proxies.filter((p) => p.healthy).length,
      failed: this.proxies.filter((p) => !p.healthy).length,
    };
  }

  private pickNext(pool: ProxyEntry[]): ProxyConfig {
    this.currentIndex = (this.currentIndex + 1) % pool.length;
    const entry = pool[this.currentIndex]!;
    entry.lastUsed = Date.now();
    return entry.config;
  }

  private resetAll(): void {
    for (const entry of this.proxies) {
      entry.healthy = true;
      entry.failCount = 0;
    }
  }
}

export function createProxyPoolFromEnv(env?: ScraperEnv): ProxyPool {
  const e = env ?? getEnv();
  if (!e.PROXY_HOST || !e.PROXY_PORT) {
    return new ProxyPool([]);
  }
  return new ProxyPool([
    {
      host: e.PROXY_HOST,
      port: e.PROXY_PORT,
      username: e.PROXY_USERNAME,
      password: e.PROXY_PASSWORD,
      protocol: "http",
    },
  ]);
}

// ---------------------------------------------------------------------------
// Proxy Agent (CONNECT tunnel)
// ---------------------------------------------------------------------------

function tunnelConnect(
  proxyHost: string,
  proxyPort: number,
  proxyAuth: string | undefined,
  targetHost: string,
  targetPort: number,
  timeout: number
): Promise<{ socket: import("node:net").Socket; raw: import("node:net").Socket }> {
  return new Promise((resolve, reject) => {
    const socket = new (require("node:net") as typeof import("node:net")).Socket();
    socket.setTimeout(timeout);

    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("Proxy CONNECT timeout"));
    }, timeout);

    socket.connect(proxyPort, proxyHost, () => {
      const authLine = proxyAuth
        ? `Proxy-Authorization: Basic ${proxyAuth}\r\n`
        : "";
      socket.write(
        `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\nHost: ${targetHost}:${targetPort}\r\n${authLine}\r\n`
      );
    });

    socket.once("data", (data: Buffer) => {
      clearTimeout(timer);
      const head = data.toString();
      const match = head.match(/^HTTP\/1\.\d (\d{3})/);
      if (match && match[1] === "200") {
        resolve({ socket, raw: socket });
      } else {
        socket.destroy();
        reject(
          new Error(
            `Proxy CONNECT failed: ${match?.[1] ?? "unknown"} — ${head.split("\r\n")[0]}`
          )
        );
      }
    });

    socket.on("error", (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });

    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("Proxy CONNECT socket timeout"));
    });
  });
}

// ---------------------------------------------------------------------------
// Simple fetch with proxy support
// ---------------------------------------------------------------------------

async function rawFetch(
  reqConfig: RequestConfig & { proxyUrl?: string }
): Promise<FetchResponse> {
  const { url, method = "GET", headers = {}, body, timeout = 15000, signal, proxyUrl } = reqConfig;

  const parsed = new URL(url);
  const isHttps = parsed.protocol === "https:";
  const targetPort = parsed.port ? parseInt(parsed.port) : isHttps ? 443 : 80;
  const targetHost = parsed.hostname!;
  const path = parsed.pathname + parsed.search;

  const ho: Record<string, string> = { ...headers };
  if (!ho["accept"]) ho["accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
  if (body && !ho["content-length"]) {
    ho["content-length"] = String(Buffer.byteLength(body));
  }

  const makeRequest = (
    hostname: string,
    port: number,
    socket?: import("node:net").Socket
  ): Promise<FetchResponse> => {
    return new Promise((resolve, reject) => {
      const mod = isHttps ? https : http;
      const opts: http.RequestOptions = {
        method,
        hostname,
        port,
        path: proxyUrl ? url : path,
        headers: ho,
        timeout,
        signal,
      };

      if (socket) {
        (opts as Record<string, unknown>).createConnection = () => socket;
      }

      const req = mod.request(opts, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", async () => {
          const rawBody = Buffer.concat(chunks);
          const encoding = res.headers["content-encoding"]?.toLowerCase();
          let body: Buffer;
          if (encoding === "gzip" || encoding === "x-gzip") {
            body = await new Promise<Buffer>((resolve, reject) => {
              zlib.gunzip(rawBody, (err, result) => {
                if (err) reject(err);
                else resolve(result);
              });
            });
          } else if (encoding === "deflate") {
            body = await new Promise<Buffer>((resolve, reject) => {
              zlib.inflate(rawBody, (err, result) => {
                if (err) reject(err);
                else resolve(result);
              });
            });
          } else if (encoding === "br") {
            body = await new Promise<Buffer>((resolve, reject) => {
              zlib.brotliDecompress(rawBody, (err, result) => {
                if (err) reject(err);
                else resolve(result);
              });
            });
          } else {
            body = rawBody;
          }
          const resHeaders: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (v) resHeaders[k] = Array.isArray(v) ? v.join(", ") : v;
          }
          resolve({
            ok: res.statusCode! >= 200 && res.statusCode! < 400,
            status: res.statusCode!,
            statusText: res.statusMessage ?? "",
            headers: resHeaders,
            text: async () => body.toString("utf-8"),
            json: async <T>() => JSON.parse(body.toString("utf-8")) as T,
          });
        });
        res.on("error", reject);
      });

      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error(`Request timeout after ${timeout}ms`));
      });

      if (body) req.write(body);
      req.end();
    });
  };

  if (!proxyUrl) {
    return makeRequest(targetHost, targetPort);
  }

  const proxy = new URL(proxyUrl);
  const proxyHost = proxy.hostname!;
  const proxyPort = parseInt(proxy.port) || 8080;
  const proxyAuth = proxy.username
    ? Buffer.from(`${proxy.username}:${decodeURIComponent(proxy.password)}`).toString(
        "base64"
      )
    : undefined;

  if (isHttps) {
    const tunnelModule = await import("node:tls");
    const { socket } = await tunnelConnect(
      proxyHost,
      proxyPort,
      proxyAuth,
      targetHost,
      targetPort,
      timeout
    );
    let tlsSocket: import("node:tls").TLSSocket | undefined;
    const finalSocket = tunnelModule.connect({
      socket,
      servername: targetHost,
      rejectUnauthorized: true,
    });
    tlsSocket = finalSocket;
    await new Promise<void>((resolve, reject) => {
      finalSocket.once("secureConnect", resolve);
      finalSocket.once("error", reject);
    });
    return makeRequest(targetHost, targetPort, finalSocket);
  }

  ho["host"] = `${targetHost}:${targetPort}`;
  return makeRequest(proxyHost, proxyPort);
}

// ---------------------------------------------------------------------------
// Token Bucket Rate Limiter
// ---------------------------------------------------------------------------

export class TokenBucketRateLimiter implements RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number;
  private refillIntervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private waiting: Array<() => void> = [];

  constructor(
    maxTokens: number,
    refillPerSecond: number,
    refillIntervalMs = 100
  ) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = (refillPerSecond * refillIntervalMs) / 1000;
    this.refillIntervalMs = refillIntervalMs;
    this.startRefill();
  }

  async acquire(): Promise<void> {
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    return new Promise<void>((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    this.tokens = Math.min(this.tokens + 1, this.maxTokens);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private startRefill(): void {
    this.timer = setInterval(() => {
      this.tokens = Math.min(this.tokens + this.refillRate, this.maxTokens);
      while (this.waiting.length > 0 && this.tokens >= 1) {
        this.tokens -= 1;
        const resolve = this.waiting.shift();
        if (resolve) resolve();
      }
    }, this.refillIntervalMs);
    if (this.timer && typeof this.timer === "object" && "unref" in this.timer) {
      this.timer.unref();
    }
  }
}

// ---------------------------------------------------------------------------
// User-Agent & Header Randomizer
// ---------------------------------------------------------------------------

interface UaProfile {
  ua: string;
  platform: string;
  secChUa: string;
  secChUaPlatform: string;
  acceptLanguage: string;
}

const UA_PROFILES: UaProfile[] = [
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    platform: "Windows",
    secChUa: '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    secChUaPlatform: '"Windows"',
    acceptLanguage: "en-US,en;q=0.9",
  },
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    platform: "Windows",
    secChUa: '"Google Chrome";v="130", "Chromium";v="130", "Not_A Brand";v="23"',
    secChUaPlatform: '"Windows"',
    acceptLanguage: "en-US,en;q=0.9",
  },
  {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    platform: "macOS",
    secChUa: '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    secChUaPlatform: '"macOS"',
    acceptLanguage: "en-US,en;q=0.9",
  },
  {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
    platform: "macOS",
    secChUa: '"Safari";v="18.2", "Apple";v="18.2"',
    secChUaPlatform: '"macOS"',
    acceptLanguage: "en-US,en;q=0.9",
  },
  {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    platform: "macOS",
    secChUa: '"Google Chrome";v="129", "Chromium";v="129", "Not_A Brand";v="22"',
    secChUaPlatform: '"macOS"',
    acceptLanguage: "en-US,en;q=0.9",
  },
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    platform: "Windows",
    secChUa: '"Google Chrome";v="128", "Chromium";v="128", "Not_A Brand";v="21"',
    secChUaPlatform: '"Windows"',
    acceptLanguage: "en-US,en;q=0.9",
  },
];

export class UserAgentRotator {
  private profiles: UaProfile[];
  private index = 0;

  constructor(profiles?: UaProfile[]) {
    this.profiles = profiles ?? UA_PROFILES;
  }

  next(): UaProfile {
    this.index = (this.index + 1) % this.profiles.length;
    return this.profiles[this.index]!;
  }

  random(): UaProfile {
    const i = Math.floor(Math.random() * this.profiles.length);
    return this.profiles[i]!;
  }
}

export class HeaderRandomizer {
  private uaRotator: UserAgentRotator;

  constructor(uaRotator?: UserAgentRotator) {
    this.uaRotator = uaRotator ?? new UserAgentRotator();
  }

  generate(
    extra: Record<string, string> = {},
    referer?: string
  ): Record<string, string> {
    const profile = this.uaRotator.random();

    const headers: Record<string, string> = {
      "user-agent": profile.ua,
      "sec-ch-ua": profile.secChUa,
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": profile.secChUaPlatform,
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "none",
      "sec-fetch-user": "?1",
      "accept-language": profile.acceptLanguage,
      "accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "accept-encoding": "gzip, deflate, br",
      "cache-control": "max-age=0",
      "upgrade-insecure-requests": "1",
      dnt: "1",
      ...extra,
    };

    if (referer) {
      headers["referer"] = referer;
      headers["sec-fetch-site"] = "same-origin";
    }

    return headers;
  }
}

// ---------------------------------------------------------------------------
// Resilient Request Executor
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(baseMs: number): number {
  return baseMs + Math.random() * baseMs;
}

export class ResilientFetcher {
  private proxyPool: ProxyPool;
  private headerRandomizer: HeaderRandomizer;
  private rateLimiter: RateLimiter;
  private defaultRetryMax: number;
  private defaultBackoffMs: number;
  private defaultTimeout: number;
  private onFailedProxy: ((config: ProxyConfig) => void) | null = null;

  constructor(options: {
    proxyPool: ProxyPool;
    headerRandomizer?: HeaderRandomizer;
    rateLimiter?: RateLimiter;
    retryMaxAttempts?: number;
    retryBackoffMs?: number;
    timeout?: number;
    onFailedProxy?: (config: ProxyConfig) => void;
  }) {
    this.proxyPool = options.proxyPool;
    this.headerRandomizer = options.headerRandomizer ?? new HeaderRandomizer();
    this.rateLimiter = options.rateLimiter ?? new TokenBucketRateLimiter(10, 5);
    this.defaultRetryMax = options.retryMaxAttempts ?? 3;
    this.defaultBackoffMs = options.retryBackoffMs ?? 1000;
    this.defaultTimeout = options.timeout ?? 15000;
    this.onFailedProxy = options.onFailedProxy ?? null;
  }

  async fetch(config: ResilientRequestConfig): Promise<FetchResponse> {
    const maxRetries = config.retryMaxAttempts ?? this.defaultRetryMax;
    const backoffMs = config.retryBackoffMs ?? this.defaultBackoffMs;
    const timeout = config.timeout ?? this.defaultTimeout;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const proxy = this.proxyPool.getProxy();
      const headers = this.headerRandomizer.generate(config.headers);

      await this.rateLimiter.acquire();

      let proxyUrl: string | undefined;
      if (proxy && proxy.host !== "" && proxy.port !== 0) {
        const u = new URL("http://localhost");
        u.hostname = proxy.host;
        u.port = String(proxy.port);
        if (proxy.username) {
          u.username = proxy.username;
          u.password = proxy.password ?? "";
        }
        proxyUrl = u.toString().replace("localhost", proxy.host);
      }

      try {
        const response = await rawFetch({
          url: config.url,
          method: config.method,
          headers,
          body: config.body,
          timeout,
          signal: config.signal,
          proxyUrl,
        });

        this.rateLimiter.release();
        if (proxy) this.proxyPool.markSuccess(proxy);

        if (response.status === 429 || response.status >= 500) {
          if (attempt < maxRetries) {
            const delay = jitter(backoffMs * Math.pow(2, attempt));
            await sleep(delay);
            continue;
          }
          return response;
        }

        return response;
      } catch (err) {
        this.rateLimiter.release();
        if (proxy) {
          this.proxyPool.markFailed(proxy);
          this.onFailedProxy?.(proxy);
        }

        if (attempt < maxRetries) {
          const delay = jitter(backoffMs * Math.pow(2, attempt));
          await sleep(delay);
          continue;
        }

        throw err instanceof Error
          ? err
          : new Error(String(err));
      }
    }

    throw new Error("Max retries exceeded");
  }

  getProxyStats() {
    return this.proxyPool.stats();
  }
}

export function createResilientFetcherFromEnv(env?: ScraperEnv): ResilientFetcher {
  const e = env ?? getEnv();
  const pool = createProxyPoolFromEnv(e);
  const limiter = new TokenBucketRateLimiter(e.CONCURRENCY_LIMIT, e.CONCURRENCY_LIMIT);
  return new ResilientFetcher({
    proxyPool: pool,
    rateLimiter: limiter,
    retryMaxAttempts: e.RETRY_MAX_ATTEMPTS,
    retryBackoffMs: e.RETRY_BACKOFF_MS,
    timeout: e.SCRAPER_REQUEST_TIMEOUT_MS,
  });
}