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

  console.log("[cleanup-non-email] Connecting to database...");
  const pool = new Pool({ connectionString, max: 2 });

  try {
    const before = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM "Agent"`,
    );
    const beforeCount = parseInt(before.rows[0]?.count ?? "0", 10);
    console.log(`[cleanup-non-email] Total agents before cleanup: ${beforeCount}`);

    const purgeCount = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM "Agent"
       WHERE "email" IS NULL
          OR "email" = ''
          OR "emailStatus" NOT IN ('validated', 'mx_verified')`,
    );
    const toPurge = parseInt(purgeCount.rows[0]?.count ?? "0", 10);
    console.log(`[cleanup-non-email] Agents to purge (no verified email): ${toPurge}`);

    if (toPurge === 0) {
      console.log("[cleanup-non-email] No records to purge. Nothing to do.");
    } else {
      console.log(`[cleanup-non-email] Deleting ${toPurge} non-email records...`);
      const result = await pool.query(
        `DELETE FROM "Agent"
         WHERE "email" IS NULL
            OR "email" = ''
            OR "emailStatus" NOT IN ('validated', 'mx_verified')`,
      );
      console.log(`[cleanup-non-email] Deleted ${result.rowCount ?? toPurge} records.`);
    }

    const after = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM "Agent"`,
    );
    const afterCount = parseInt(after.rows[0]?.count ?? "0", 10);

    const noEmailCount = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM "Agent"
       WHERE "email" IS NULL OR "email" = ''`,
    );
    const remainingNoEmail = parseInt(noEmailCount.rows[0]?.count ?? "0", 10);

    const noZipCount = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM "Agent"
       WHERE "zipCode" IS NULL OR "zipCode" = ''`,
    );
    const remainingNoZip = parseInt(noZipCount.rows[0]?.count ?? "0", 10);

    console.log(`[cleanup-non-email] Remaining agents: ${afterCount}`);
    console.log(`[cleanup-non-email] Remaining without email: ${remainingNoEmail}`);
    console.log(`[cleanup-non-email] Remaining without zip code: ${remainingNoZip}`);

    if (remainingNoEmail === 0) {
      console.log("[cleanup-non-email] VERIFIED: All remaining agents have valid emails.");
    } else {
      console.warn(`[cleanup-non-email] WARNING: ${remainingNoEmail} agents still have no email.`);
    }
  } catch (err) {
    console.error(
      "[cleanup-non-email] Cleanup failed:",
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    await pool.end();
    console.log("[cleanup-non-email] Database connection closed.");
  }
}

main();