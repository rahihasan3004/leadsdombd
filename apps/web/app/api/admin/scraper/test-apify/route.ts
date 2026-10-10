import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-guard";
import { checkRateLimit } from "@fine-leads/utils/rate-limit";
import {
  CompassApifyClient,
  buildApifySearchStrings,
} from "@/lib/scraper/apify-client";
import { ApifyError } from "@/lib/scraper/apify-token-pool";
import { ingestApifyLeads } from "@/lib/scraper/apify-mapper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const querySchema = z.object({
  state: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/),
  city: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(25).default(5),
  runReference: z
    .string()
    .regex(/^apify:[a-f0-9]{24}:[a-zA-Z0-9_-]{1,64}$/)
    .optional(),
});

/** POST only: paid scrapes must not start on link prefetch/crawler GETs.
 * Repeat POST with returned runReference to poll/ingest without starting another run.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid state, city, limit or runReference" },
      { status: 400 },
    );
  const { state, city, limit, runReference } = parsed.data;
  try {
    const searchStrings = buildApifySearchStrings({
      stateCode: state,
      city,
      maxQueries: 1,
    });
    const allowed = await checkRateLimit(
      `apify-test:${admin.user.id}:${runReference ? "poll" : "start"}`,
      runReference ? 20 : 2,
      60_000,
    );
    if (!allowed.allowed)
      return NextResponse.json(
        { error: "Too many Apify test requests" },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.max(1, Math.ceil((allowed.resetAt - Date.now()) / 1000)),
            ),
          },
        },
      );
    const client = new CompassApifyClient();
    const dispatched = runReference
      ? null
      : await client.dispatchApifyScrape({
          searchStrings,
          maxPlaces: limit,
          stateCode: state,
        });
    const reference = runReference ?? dispatched!.runReference;
    const run = dispatched?.run ?? (await client.getRun(reference));
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(run.status))
      return NextResponse.json(
        {
          error: "Apify test run failed",
          runReference: reference,
          status: run.status,
        },
        { status: 502 },
      );
    if (run.status !== "SUCCEEDED")
      return NextResponse.json(
        {
          runReference: reference,
          status: run.status,
          scraped: 0,
          inserted: 0,
          skipped: 0,
          message:
            "Repeat POST with runReference to collect the completed dataset; do not start a second run.",
        },
        { status: 202, headers: { "Retry-After": "15" } },
      );
    const page = await client.getDatasetPage(reference, 1, limit);
    const summary = await ingestApifyLeads(page.data, {
      state,
      city,
      category: "real estate agents",
    });
    return NextResponse.json({
      runReference: reference,
      status: run.status,
      scraped: summary.totalFetched,
      inserted: summary.newlyIngested,
      skipped:
        summary.duplicatesSkipped +
        summary.closedPlacesDiscarded +
        summary.invalidRecordsDiscarded,
      ...summary,
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "Invalid scraper input" },
        { status: 400 },
      );
    if (error instanceof ApifyError) {
      console.error("[APIFY_ADMIN_TEST_ERROR]", {
        code: error.code,
        status: error.status,
        uncertain: error.uncertain,
      });
      return NextResponse.json(
        { error: error.message, uncertain: error.uncertain },
        {
          status:
            error.code === "RATE_LIMITED"
              ? 429
              : error.code === "QUOTA_EXHAUSTED"
                ? 402
                : error.code === "CONFIGURATION"
                  ? 400
                  : 502,
          ...(error.retryAfterMs
            ? {
                headers: {
                  "Retry-After": String(Math.ceil(error.retryAfterMs / 1000)),
                },
              }
            : {}),
        },
      );
    }
    console.error("[APIFY_ADMIN_TEST_ERROR]", { code: "INGESTION_FAILED" });
    return NextResponse.json(
      { error: "Unable to complete Apify test ingestion" },
      { status: 500 },
    );
  }
}
