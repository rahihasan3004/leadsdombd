import { DatabaseSynchronizer } from "./db-sync.js";

const DB_URL_ENV_KEYS = ["DIRECT_URL", "DATABASE_URL", "NEON_DATABASE_URL"] as const;

function resolveUrl(): string {
  for (const key of DB_URL_ENV_KEYS) {
    const val = process.env[key];
    if (val) return val;
  }
  throw new Error(
    "No database URL found. Set DIRECT_URL, DATABASE_URL, or NEON_DATABASE_URL.",
  );
}

function extractHost(dbUrl: string): string {
  try {
    const url = new URL(dbUrl);
    return `${url.protocol}//${url.hostname}:${url.port || "5432"}`;
  } catch {
    return dbUrl;
  }
}

async function main(): Promise<void> {
  console.log("[test-db] Resolving database connection...");

  let dbUrl: string;
  try {
    dbUrl = resolveUrl();
  } catch (err) {
    console.error(
      "[test-db] Failed to resolve database URL:",
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  }

  const masked = dbUrl.replace(/\/\/(.+):(.+)@/, "//***:***@");
  console.log(`[test-db] Using: ${masked}`);

  const sync = new DatabaseSynchronizer(dbUrl);

  try {
    const healthy = await sync.healthCheck();
    console.log(`[test-db] Health check: ${healthy ? "OK" : "FAILED"}`);

    if (!healthy) {
      console.error(
        `[test-db] Database health check failed. Could not connect to ${extractHost(dbUrl)}. ` +
          "Check that the database is running and the connection string is correct.",
      );
      process.exit(1);
    }

    const count = await sync.getAgentCount();
    console.log(`[test-db] Agent table count: ${count}`);

    console.log("[test-db] Connection test passed.");
  } catch (err) {
    console.error(
      "[test-db] Connection test failed:",
      err instanceof Error ? err.message : String(err),
    );
    console.error(
      `[test-db] Target host: ${extractHost(dbUrl)}`,
    );
    process.exit(1);
  } finally {
    await sync.close();
  }
}

main().catch((err) => {
  console.error("[test-db] Unexpected error:", err);
  process.exit(1);
});