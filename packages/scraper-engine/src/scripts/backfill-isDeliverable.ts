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
  const connectionString = resolveDatabaseUrl();
  const pool = new Pool({ connectionString, max: 2 });

  try {
    const beforeCount = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM "Agent" WHERE "isDeliverable" = true`,
    );
    console.log(
      `[backfill-isDeliverable] Deliverable agents before: ${beforeCount.rows[0]?.count ?? "0"}`,
    );

    const result = await pool.query(
      `UPDATE "Agent"
       SET "isDeliverable" = true
       WHERE ("emailStatus" = 'mx_verified' OR ("email" IS NOT NULL AND "email" != ''))
         AND "isDeliverable" != true`,
    );
    console.log(
      `[backfill-isDeliverable] Updated ${result.rowCount ?? 0} agent(s) to isDeliverable = true.`,
    );

    const afterCount = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM "Agent" WHERE "isDeliverable" = true`,
    );
    console.log(
      `[backfill-isDeliverable] Deliverable agents after: ${afterCount.rows[0]?.count ?? "0"}`,
    );
  } catch (err) {
    console.error(
      "[backfill-isDeliverable] Backfill failed:",
      err instanceof Error ? err.message : String(err),
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
    console.log("[backfill-isDeliverable] Database connection closed.");
  }
}

main();
