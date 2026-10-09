import { db } from "@fine-leads/database";

interface BucketRow { bucket: string; count: bigint | number }

/** One query, at most twelve monthly rows; preserve the legacy purchase fallback. */
export async function getMonthlyLeadCounts(userId: string, from: Date, until: Date) {
  const rows = await db.$queryRaw<BucketRow[]>`
    WITH unlocked AS (
      SELECT date_trunc('month', "createdAt") AS month, COUNT(*) AS count
      FROM "UnlockedLead"
      WHERE "userId" = ${userId}
        AND "createdAt" >= ${from}::timestamp
        AND "createdAt" < ${until}::timestamp
      GROUP BY 1
    )
    SELECT to_char(month, 'YYYY-MM') AS bucket, count FROM unlocked
    UNION ALL
    SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS bucket,
           COALESCE(SUM("leadCount"), 0)::bigint AS count
    FROM "LeadPurchase"
    WHERE "userId" = ${userId} AND status = 'COMPLETED'
      AND "createdAt" >= ${from}::timestamp
      AND "createdAt" < ${until}::timestamp
      AND NOT EXISTS (SELECT 1 FROM unlocked)
    GROUP BY 1
    ORDER BY bucket
  `;
  return new Map(rows.map((row) => [row.bucket, Number(row.count)]));
}

/** One query regardless of the number of days. Missing days are zero-filled in Node. */
export async function getScraperDailyCounts(days = 14, now = new Date()) {
  if (!Number.isSafeInteger(days) || days < 1 || days > 366) {
    throw new RangeError("days must be an integer between 1 and 366");
  }
  const until = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const from = new Date(until);
  from.setUTCDate(from.getUTCDate() - days);
  const rows = await db.$queryRaw<BucketRow[]>`
    SELECT to_char(date_trunc('day', "scrapedAt"), 'YYYY-MM-DD') AS bucket,
           COUNT(*) AS count
    FROM "Agent"
    WHERE "dataSource" = 'SCRAPER_ENGINE'
      AND "scrapedAt" >= ${from}::timestamp
      AND "scrapedAt" < ${until}::timestamp
    GROUP BY 1
    ORDER BY bucket
  `;
  const counts = new Map(rows.map((row) => [row.bucket, Number(row.count)]));
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(from);
    date.setUTCDate(date.getUTCDate() + i);
    const key = date.toISOString().slice(0, 10);
    return { date: key, count: counts.get(key) ?? 0 };
  });
}
