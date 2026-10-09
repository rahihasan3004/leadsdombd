import { NextRequest, NextResponse } from "next/server";
import { db } from "@fine-leads/database";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-guard";
import {
  LobstrClient,
  LobstrError,
  type LobstrRun,
} from "@/lib/scraper/lobstr-client";
import { ingestLobstrLeads } from "@/lib/scraper/lead-mapper";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;
const states = new Set(
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(
    " ",
  ),
);
const parametersSchema = z.object({
  state: z
    .string()
    .trim()
    .toUpperCase()
    .refine((value) => states.has(value), "Use a US state code"),
  city: z.string().trim().min(1).max(100),
  category: z.string().trim().min(1).max(120).default("real estate agents"),
  limit: z.coerce.number().int().min(1).max(100).default(5),
});
const summarySchema = z.object({
  totalFetched: z.number().int().nonnegative(),
  duplicatesSkipped: z.number().int().nonnegative(),
  closedPlacesDiscarded: z.number().int().nonnegative(),
  invalidRecordsDiscarded: z.number().int().nonnegative(),
  newlyIngested: z.number().int().nonnegative(),
});
const detailsSchema = z.object({
  parameters: parametersSchema,
  summary: summarySchema.optional(),
});
const runIdSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[\w-]+$/);
const resource = "LOBSTR_RUN";
const action = "LOBSTR_INGESTION";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
async function loadJob(runId: string, userId: string) {
  return db.auditLog.findFirst({
    where: { resource, action, resourceId: runId, userId },
    orderBy: { createdAt: "desc" },
  });
}
function failed(run: LobstrRun) {
  return run.status === "ERROR" || run.status === "ABORTED";
}
function ready(run: LobstrRun) {
  return run.status === "DONE" && run.export_done === true;
}
function errorResponse(error: unknown) {
  // No upstream bodies, raw leads, API keys or database diagnostics in HTTP responses/logs.
  if (error instanceof LobstrError)
    return json(
      { error: error.message },
      error.message.includes("not configured") ? 503 : 502,
    );
  return json(
    {
      error:
        "Lobstr ingestion failed; resume the recorded run instead of dispatching another scrape",
    },
    500,
  );
}

/** GET is status-only: link previews/prefetching must never trigger a paid scrape or write leads. */
export async function GET(request: NextRequest) {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  const parsed = runIdSchema.safeParse(
    request.nextUrl.searchParams.get("runId"),
  );
  if (!parsed.success)
    return json(
      {
        error:
          "Use POST to start a scrape; GET requires runId and only reads status",
      },
      400,
    );
  try {
    const job = await loadJob(parsed.data, admin.user.id);
    if (!job) return json({ error: "Run not found for this admin" }, 404);
    const details = detailsSchema.parse(job.details);
    if (details.summary)
      return json({
        runId: parsed.data,
        status: "INGESTED",
        ...details.summary,
      });
    const run = await new LobstrClient().getRunStatus(parsed.data);
    return json({
      runId: run.id,
      status: run.status,
      exportReady: run.export_done === true,
      doneReason: run.done_reason ?? null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Authenticated POST starts, or resumes by runId, a small ingestion smoke test. */
export async function POST(request: NextRequest) {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin)
    return json({ error: "Cross-origin scrape requests are not allowed" }, 403);
  const query = request.nextUrl.searchParams;
  const resumeId = query.get("runId");
  if (resumeId !== null && !runIdSchema.safeParse(resumeId).success)
    return json({ error: "Invalid runId" }, 400);
  let runId: string | undefined = resumeId ?? undefined;
  try {
    let job;
    let parameters: z.infer<typeof parametersSchema>;
    let run: LobstrRun;
    if (resumeId) {
      job = await loadJob(resumeId, admin.user.id);
      if (!job) return json({ error: "Run not found for this admin" }, 404);
      const details = detailsSchema.parse(job.details);
      if (details.summary)
        return json({
          runId: resumeId,
          status: "INGESTED",
          ...details.summary,
        });
      parameters = details.parameters; // Resume trusted persisted inputs, not caller-supplied overrides.
      run = await new LobstrClient().getRunStatus(resumeId);
    } else {
      const parsed = parametersSchema.safeParse({
        state: query.get("state") ?? undefined,
        city: query.get("city") ?? undefined,
        category: query.get("category") ?? undefined,
        limit: query.get("limit") ?? undefined,
      });
      if (!parsed.success)
        return json(
          {
            error: "Invalid parameters",
            issues: parsed.error.flatten().fieldErrors,
          },
          400,
        );
      parameters = parsed.data;
      const client = new LobstrClient(); // Fail missing configuration before any DB write or chargeable request.
      // Audit intent before dispatch. If a POST response is lost, inspect Lobstr before retrying kickoff.
      job = await db.auditLog.create({
        data: {
          userId: admin.user.id,
          resource,
          action,
          details: { parameters },
        },
      });
      run = await client.triggerScrapeRun(parameters);
      runId = run.id;
      await db.auditLog.update({
        where: { id: job.id },
        data: { resourceId: run.id },
      });
    }
    runId = run.id;
    const client = new LobstrClient();
    const deadline = Date.now() + 12_000;
    // A Google Maps scrape can take minutes; never keep a serverless request alive indefinitely.
    while (
      !ready(run) &&
      !failed(run) &&
      run.status !== "PAUSED" &&
      Date.now() + 10_000 < deadline
    ) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      run = await client.getRunStatus(run.id);
    }
    if (failed(run))
      return json(
        {
          runId,
          status: run.status,
          error: "Lobstr run failed; no results ingested",
          doneReason: run.done_reason ?? null,
        },
        502,
      );
    if (!ready(run))
      return json(
        {
          runId,
          status: run.status,
          exportReady: run.export_done === true,
          pending: true,
          resumeMethod: "POST",
          resumeUrl: `${request.nextUrl.pathname}?runId=${encodeURIComponent(runId)}`,
        },
        202,
      );
    const records = await client.getRunResults(runId, {
      limit: parameters.limit,
    });
    const summary = await ingestLobstrLeads(records, parameters);
    await db.auditLog.update({
      where: { id: job.id },
      data: { details: { parameters, summary: { ...summary } } },
    });
    return json({
      runId,
      status: "INGESTED",
      doneReason: run.done_reason ?? null,
      ...summary,
    });
  } catch (error) {
    const response = errorResponse(error);
    if (!runId) return response;
    const body = (await response.json()) as Record<string, unknown>;
    return json(
      {
        ...body,
        runId,
        resumeMethod: "POST",
        resumeUrl: `${request.nextUrl.pathname}?runId=${encodeURIComponent(runId)}`,
      },
      response.status,
    );
  }
}
