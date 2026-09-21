import { z } from "zod";

const envSchema = z.object({
  PROXY_HOST: z.string().optional(),
  PROXY_PORT: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .pipe(z.number().int().min(1).max(65535).optional()),
  PROXY_USERNAME: z.string().optional(),
  PROXY_PASSWORD: z.string().optional(),
  DATABASE_URL: z
    .string()
    .url("DATABASE_URL must be a valid URL")
    .startsWith("postgres", "DATABASE_URL must be a PostgreSQL URL")
    .optional(),
  NEON_DATABASE_URL: z
    .string()
    .url("NEON_DATABASE_URL must be a valid URL")
    .startsWith("postgres", "NEON_DATABASE_URL must be a PostgreSQL URL")
    .optional(),
  DIRECT_URL: z
    .string()
    .url("DIRECT_URL must be a valid URL")
    .startsWith("postgres", "DIRECT_URL must be a PostgreSQL URL")
    .optional(),
  CONCURRENCY_LIMIT: z
    .string()
    .optional()
    .default("5")
    .transform(Number)
    .pipe(z.number().int().min(1).max(50)),
  RETRY_MAX_ATTEMPTS: z
    .string()
    .optional()
    .default("3")
    .transform(Number)
    .pipe(z.number().int().min(1).max(10)),
  RETRY_BACKOFF_MS: z
    .string()
    .optional()
    .default("1000")
    .transform(Number)
    .pipe(z.number().int().min(100).max(30000)),
  SCRAPER_REQUEST_TIMEOUT_MS: z
    .string()
    .optional()
    .default("15000")
    .transform(Number)
    .pipe(z.number().int().min(1000).max(60000)),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .optional()
    .default("info"),
}).refine(
  (data) => data.DATABASE_URL || data.NEON_DATABASE_URL || data.DIRECT_URL,
  {
    message:
      "At least one database URL must be provided (DATABASE_URL, NEON_DATABASE_URL, or DIRECT_URL).",
  },
);

export type ScraperEnv = z.infer<typeof envSchema>;

export function resolveDatabaseUrl(env: ScraperEnv): string {
  const url = env.DATABASE_URL ?? env.NEON_DATABASE_URL ?? env.DIRECT_URL;
  if (!url) {
    throw new Error(
      "No database URL resolved. Set DATABASE_URL, NEON_DATABASE_URL, or DIRECT_URL.",
    );
  }
  return url;
}

export function parseEnv(
  env: Record<string, string | undefined> = process.env,
): ScraperEnv {
  const result = envSchema.safeParse(env);

  if (!result.success) {
    const missingVars = result.error.issues
      .filter(
        (issue) =>
          issue.code === "invalid_type" && issue.received === "undefined",
      )
      .map((issue) => issue.path.join("."));

    const detail = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `Scraper engine environment validation failed.\n\nMissing required variables: ${missingVars.join(", ") || "none"}\n\nAll issues:\n${detail}`,
    );
  }

  return result.data;
}

let cachedEnv: ScraperEnv | null = null;

export function getEnv(): ScraperEnv {
  if (!cachedEnv) {
    cachedEnv = parseEnv();
  }
  return cachedEnv;
}