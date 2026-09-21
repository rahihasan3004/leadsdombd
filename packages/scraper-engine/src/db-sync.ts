import { Pool } from "pg";
import { getEnv, resolveDatabaseUrl } from "./config/env.js";
import type { VerifiedLeadPayload } from "./types/lead.types.js";

export interface DatabaseSyncStats {
  upserted: number;
  skippedDuplicates: number;
  errors: number;
}

const UPSERT_SQL = `
INSERT INTO "Agent" (
  id, "fullName", "firstName", "lastName", "brokerageName", phone, state, "zipCode", city, timezone,
  "brokerageAddress", category, "googleMainCategory", "googleSubcategories",
  "websiteUrl", rating, "reviewCount", "scrapedAt", email,
  "emailStatus", "googlePlaceId", "googleMapsLink", "dataSource",
  "isVerified", "verificationScore", "licenseStatus", "updatedAt"
) VALUES (gen_random_uuid(), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25, NOW())
ON CONFLICT ("googlePlaceId") DO UPDATE SET
  rating = EXCLUDED.rating,
  "reviewCount" = EXCLUDED."reviewCount",
  "scrapedAt" = EXCLUDED."scrapedAt",
  "emailStatus" = EXCLUDED."emailStatus",
  "websiteUrl" = EXCLUDED."websiteUrl",
  "firstName" = CASE
    WHEN EXCLUDED."firstName" IS NOT NULL AND EXCLUDED."firstName" != ''::text
    THEN EXCLUDED."firstName"
    ELSE "Agent"."firstName"
  END,
  "lastName" = CASE
    WHEN EXCLUDED."lastName" IS NOT NULL AND EXCLUDED."lastName" != ''::text
    THEN EXCLUDED."lastName"
    ELSE "Agent"."lastName"
  END,
  "updatedAt" = NOW(),
  email = CASE
    WHEN EXCLUDED.email IS NOT NULL AND EXCLUDED.email != ''::text
    THEN EXCLUDED.email
    ELSE "Agent".email
  END
`;

const EMAIL_DUPE_CHECK = `SELECT "googlePlaceId" FROM "Agent" WHERE email = $1 AND "googlePlaceId" != $2 LIMIT 1`;

const HEALTH_CHECK = "SELECT 1 AS ok";

export class DatabaseSynchronizer {
  private pool: Pool;

  constructor(connectionString?: string) {
    const env = getEnv();
    this.pool = new Pool({
      connectionString: connectionString ?? resolveDatabaseUrl(env),
      max: env.CONCURRENCY_LIMIT,
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.pool.query(HEALTH_CHECK);
      return result.rows.length === 1;
    } catch {
      return false;
    }
  }

  async upsertLead(
    lead: VerifiedLeadPayload,
  ): Promise<{ status: "inserted" | "updated" | "skipped_duplicate" | "error"; error?: string }> {
    if (lead.email) {
      const existing = await this.pool.query(EMAIL_DUPE_CHECK, [
        lead.email,
        lead.googlePlaceId,
      ]);
      if (existing.rows.length > 0) {
        return { status: "skipped_duplicate" };
      }
    }

    try {
      await this.pool.query(UPSERT_SQL, [
        lead.firstName && lead.lastName
          ? `${lead.firstName} ${lead.lastName}`
          : lead.companyName,
        lead.firstName || null,
        lead.lastName || null,
        lead.brokerageName || lead.companyName,
        lead.phone,
        lead.state,
        lead.zipCode,
        lead.city,
        lead.timezone,
        lead.address,
        lead.category,
        lead.googleMainCategory,
        lead.googleSubcategories,
        lead.website,
        lead.rating,
        lead.reviewCount,
        lead.scrapedAt,
        lead.email || null,
        lead.emailStatus,
        lead.googlePlaceId,
        lead.googleMapsLink,
        "SCRAPER_ENGINE",
        true,
        100,
        "ACTIVE",
      ]);

      return { status: "inserted" };
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        "code" in err &&
        (err as Record<string, unknown>).code === "23505" &&
        typeof (err as Record<string, unknown>).message === "string" &&
        ((err as Record<string, unknown>).message as string).includes("email")
      ) {
        return { status: "skipped_duplicate" };
      }
      return {
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async upsertBatch(leads: VerifiedLeadPayload[]): Promise<DatabaseSyncStats> {
    const stats: DatabaseSyncStats = { upserted: 0, skippedDuplicates: 0, errors: 0 };

    for (const lead of leads) {
      const result = await this.upsertLead(lead);
      if (result.status === "inserted" || result.status === "updated") {
        stats.upserted++;
      } else if (result.status === "skipped_duplicate") {
        stats.skippedDuplicates++;
      } else {
        stats.errors++;
      }
    }

    return stats;
  }

  async getAgentCount(): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM "Agent"`,
    );
    return parseInt(result.rows[0]?.count ?? "0", 10);
  }

  async getAgentByPlaceId(placeId: string): Promise<{ email: string; emailStatus: string } | null> {
    const result = await this.pool.query<{ email: string; emailStatus: string }>(
      `SELECT email, "emailStatus" FROM "Agent" WHERE "googlePlaceId" = $1 LIMIT 1`,
      [placeId],
    );
    return result.rows[0] ?? null;
  }

  async deleteByPlaceId(placeId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM "Agent" WHERE "googlePlaceId" = $1`,
      [placeId],
    );
  }

  async getLatestAgents(limit: number): Promise<
    Array<{
      id: string;
      fullName: string;
      email: string | null;
      emailStatus: string | null;
      phone: string | null;
      websiteUrl: string | null;
      isVerified: boolean;
      googlePlaceId: string | null;
      createdAt: string;
    }>
  > {
    const result = await this.pool.query<
      {
        id: string;
        fullName: string;
        email: string | null;
        emailStatus: string | null;
        phone: string | null;
        websiteUrl: string | null;
        isVerified: boolean;
        googlePlaceId: string | null;
        createdAt: string;
      }
    >(
      `SELECT id, "fullName", email, "emailStatus", phone, "websiteUrl", "isVerified", "googlePlaceId", "createdAt"
       FROM "Agent"
       WHERE "dataSource" = 'SCRAPER_ENGINE'
       ORDER BY "createdAt" DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}