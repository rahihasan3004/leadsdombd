import { Pool } from "pg";

function resolveDatabaseUrl(): string {
  const url =
    process.env["DATABASE_URL"] ??
    process.env["NEON_DATABASE_URL"] ??
    process.env["DIRECT_URL"];
  if (!url) {
    throw new Error(
      "No database URL found. Set DATABASE_URL, NEON_DATABASE_URL, or DIRECT_URL.",
    );
  }
  return url;
}

async function main(): Promise<void> {
  if (process.env["NODE_ENV"] !== "development") {
    throw new Error(
      "reset-agents can only run in development. NODE_ENV must be 'development'.",
    );
  }

  const connectionString = resolveDatabaseUrl();

  console.log("[reset-agents] Connecting to database...");
  const pool = new Pool({ connectionString, max: 2 });

  try {
    const before = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM "Agent"`,
    );
    const beforeCount = parseInt(before.rows[0]?.count ?? "0", 10);
    console.log(`[reset-agents] Agent count before reset: ${beforeCount}`);

    console.log(`[reset-agents] Executing TRUNCATE TABLE "Agent" CASCADE...`);
    await pool.query(`TRUNCATE TABLE "Agent" CASCADE`);

    const after = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM "Agent"`,
    );
    const afterCount = parseInt(after.rows[0]?.count ?? "0", 10);

    if (afterCount === 0) {
      console.log(
        `[reset-agents] SUCCESS: Agent count is now ${afterCount}. Database reset complete.`,
      );
    } else {
      console.error(
        `[reset-agents] WARNING: Agent count after reset is ${afterCount}, expected 0.`,
      );
      process.exit(1);
    }
  } catch (err) {
    console.error(
      "[reset-agents] Reset failed:",
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  } finally {
    await pool.end();
    console.log("[reset-agents] Database connection closed.");
  }
}

main();