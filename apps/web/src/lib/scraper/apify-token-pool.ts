import { createHash } from "node:crypto";

export type ApifyErrorCode =
  | "CONFIGURATION"
  | "ALL_TOKENS_EXHAUSTED"
  | "QUOTA_EXHAUSTED"
  | "RATE_LIMITED"
  | "HTTP_ERROR"
  | "NETWORK_ERROR"
  | "INVALID_RESPONSE";
export class ApifyError extends Error {
  constructor(
    message: string,
    readonly code: ApifyErrorCode,
    readonly status?: number,
    readonly uncertain = false,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ApifyError";
  }
}
export interface ApifyCredential {
  readonly id: string;
  readonly token: string;
}

/** Per-process availability pool. Never rotate credentials to evade quotas/rate limits. */
export class ApifyTokenPool {
  private readonly credentials: ApifyCredential[];
  private readonly exhausted = new Set<string>();
  private activeIndex = 0;
  private cooldownUntil = 0;
  private quotaBlocked = false;
  constructor(
    tokens: readonly string[],
    private readonly now: () => number = Date.now,
  ) {
    this.credentials = [
      ...new Set(tokens.map((token) => token.trim()).filter(Boolean)),
    ].map((token) => ({
      id: createHash("sha256").update(token).digest("hex").slice(0, 24),
      token,
    }));
  }
  get size() {
    return this.credentials.length;
  }
  private assertAvailable(readOnly = false) {
    if (!this.size)
      throw new ApifyError("Apify tokens are not configured", "CONFIGURATION");
    if (this.quotaBlocked && !readOnly)
      throw new ApifyError(
        "Apify quota exhausted; replenish the account before resuming",
        "QUOTA_EXHAUSTED",
        402,
      );
    if (this.cooldownUntil > this.now())
      throw new ApifyError(
        "Apify rate-limit cooldown is active",
        "RATE_LIMITED",
        429,
        false,
        this.cooldownUntil - this.now(),
      );
  }
  select(): ApifyCredential {
    this.assertAvailable();
    for (let offset = 0; offset < this.size; offset++) {
      const index = (this.activeIndex + offset) % this.size;
      const credential = this.credentials[index]!;
      if (!this.exhausted.has(credential.id)) {
        this.activeIndex = (index + 1) % this.size; // Synchronous selection before any await.
        return credential;
      }
    }
    throw new ApifyError(
      "All configured Apify credentials are unavailable",
      "ALL_TOKENS_EXHAUSTED",
      401,
    );
  }
  pinned(id: string, readOnly = false): ApifyCredential {
    this.assertAvailable(readOnly);
    const credential = this.credentials.find((item) => item.id === id);
    if (!credential || this.exhausted.has(id))
      throw new ApifyError(
        "The credential owning this Apify run is unavailable",
        "CONFIGURATION",
      );
    return credential;
  }
  observeFailure(id: string, status: number, retryAfterMs = 60_000) {
    if (status === 401) this.exhausted.add(id);
    if (status === 402) this.quotaBlocked = true;
    if (status === 429)
      this.cooldownUntil = Math.max(
        this.cooldownUntil,
        this.now() + Math.max(1000, retryAfterMs),
      );
  }
  snapshot() {
    return {
      tokenCount: this.size,
      activeIndex: this.activeIndex,
      exhaustedCount: this.exhausted.size,
      quotaBlocked: this.quotaBlocked,
      cooldownUntil: this.cooldownUntil,
    };
  }
}

let cached: { configuration: string; pool: ApifyTokenPool } | undefined;
export function configuredApifyTokens(): string[] {
  const multiple =
    process.env.APIFY_TOKENS?.split(",")
      .map((token) => token.trim())
      .filter(Boolean) ?? [];
  return multiple.length
    ? multiple
    : [process.env.APIFY_TOKEN?.trim() ?? ""].filter(Boolean);
}
export function getApifyTokenPool(): ApifyTokenPool {
  const configuration = configuredApifyTokens().join(",");
  if (!cached || cached.configuration !== configuration)
    cached = {
      configuration,
      pool: new ApifyTokenPool(configuredApifyTokens()),
    };
  return cached.pool;
}
/** Call only after operator remediation (billing reset/replenishment), never on an API failure. */
export function resetApifyTokenPool(): void {
  cached = undefined;
}
