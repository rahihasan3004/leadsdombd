import { apifyCandidateLimit } from "./apify-email-policy";
import { z } from "zod";
import { US_STATES, type USState } from "@fine-leads/utils";
import {
  US_ZIP_CODE_REGISTRY,
  getNextAvailableZips,
} from "@fine-leads/utils/territories/us-zip-codes";
import {
  ApifyError,
  ApifyTokenPool,
  getApifyTokenPool,
} from "./apify-token-pool";

const API_URL = "https://api.apify.com/v2";
const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const runSchema = z.object({
  id: idSchema,
  status: z.enum([
    "READY",
    "RUNNING",
    "SUCCEEDED",
    "FAILED",
    "TIMING-OUT",
    "TIMED-OUT",
    "ABORTING",
    "ABORTED",
  ]),
  defaultDatasetId: idSchema,
});
export type ApifyRun = z.infer<typeof runSchema>;
export type CompassRecord = Record<string, unknown>;
const validState = (state: string) =>
  US_STATES.some((item) => item.code === state);
const dispatchSchema = z.object({
  searchStrings: z.array(z.string().trim().min(1).max(250)).min(1).max(50),
  maxPlaces: z.number().int().min(1).max(10_000),
  leadTier: z.enum(["PHONE_ONLY", "VERIFIED_EMAIL"]).optional(),
  stateCode: z
    .string()
    .trim()
    .toUpperCase()
    .refine(validState, "Invalid US state"),
});
export interface ApifyDispatchInput {
  searchStrings: string[];
  maxPlaces: number;
  leadTier?: "PHONE_ONLY" | "VERIFIED_EMAIL";
  stateCode: string;
}
export interface ApifyDispatchResult {
  run: ApifyRun;
  runReference: string;
}

export function encodeApifyRun(credentialId: string, runId: string): string {
  if (!/^[a-f0-9]{24}$/.test(credentialId))
    throw new ApifyError("Invalid run credential ID", "INVALID_RESPONSE");
  return `apify:${credentialId}:${idSchema.parse(runId)}`;
}
export function decodeApifyRun(reference: string) {
  const match = /^apify:([a-f0-9]{24}):([a-zA-Z0-9_-]{1,64})$/.exec(reference);
  if (!match)
    throw new ApifyError("Invalid Apify run reference", "INVALID_RESPONSE");
  return { credentialId: match[1]!, runId: match[2]! };
}

export function buildApifySearchStrings(input: {
  stateCode: string;
  category?: string;
  city?: string;
  zipCode?: string;
  maxQueries?: number;
}): string[] {
  const stateCode = input.stateCode.trim().toUpperCase();
  if (!validState(stateCode))
    throw new ApifyError("Invalid US state", "CONFIGURATION");
  const territory = US_ZIP_CODE_REGISTRY[stateCode as USState];
  const category = z
    .string()
    .trim()
    .min(1)
    .max(120)
    .parse(input.category ?? "Real estate agent");
  const maxQueries = z
    .number()
    .int()
    .min(1)
    .max(50)
    .parse(input.maxQueries ?? 10);
  const city = input.city
    ? territory.cities.find(
        (item) => item.name.toLowerCase() === input.city!.trim().toLowerCase(),
      )
    : undefined;
  if (input.city && !city)
    throw new ApifyError(
      "City not found in the US Territory Registry",
      "CONFIGURATION",
    );
  const selected = input.zipCode
    ? [input.zipCode]
    : city
      ? city.zipCodes.slice(0, maxQueries)
      : getNextAvailableZips(stateCode, maxQueries);
  return selected.map((zip) => {
    const location = territory.cities.find((item) =>
      item.zipCodes.includes(zip),
    );
    if (!location || (city && !city.zipCodes.includes(zip)))
      throw new ApifyError(
        "ZIP is not in the selected territory",
        "CONFIGURATION",
      );
    return `${category} in ${location.name}, ${stateCode} ${zip}`;
  });
}

export class CompassApifyClient {
  private readonly pool: ApifyTokenPool;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;
  private readonly completedRuns = new Map<string, ApifyRun>();
  constructor(
    options: {
      pool?: ApifyTokenPool;
      fetcher?: typeof fetch;
      timeoutMs?: number;
    } = {},
  ) {
    this.pool = options.pool ?? getApifyTokenPool();
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 8000;
  }
  private async request(
    path: string,
    credentialId: string,
    method: "GET" | "POST" = "GET",
    body?: unknown,
  ): Promise<unknown> {
    const credential = this.pool.pinned(credentialId, method === "GET");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(`${API_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${credential.token}`,
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
        cache: "no-store",
        redirect: "error",
      });
      if (!response.ok) {
        const header = response.headers.get("retry-after");
        const seconds = header ? Number(header) : NaN;
        const retryAfterMs = Number.isFinite(seconds)
          ? Math.max(1000, seconds * 1000)
          : header && Number.isFinite(Date.parse(header))
            ? Math.max(1000, Date.parse(header) - Date.now())
            : 60_000;
        this.pool.observeFailure(credentialId, response.status, retryAfterMs);
        throw new ApifyError(
          `Apify request failed (HTTP ${response.status})`,
          response.status === 402
            ? "QUOTA_EXHAUSTED"
            : response.status === 429
              ? "RATE_LIMITED"
              : "HTTP_ERROR",
          response.status,
          method === "POST" &&
            ![400, 401, 402, 403, 404, 422, 429].includes(response.status),
          retryAfterMs,
        );
      }
      try {
        return (await response.json()) as unknown;
      } catch {
        throw new ApifyError(
          "Apify returned malformed JSON",
          "INVALID_RESPONSE",
          undefined,
          method === "POST",
        );
      }
    } catch (error) {
      if (error instanceof ApifyError) throw error;
      throw new ApifyError(
        "Apify request did not return a confirmed response",
        "NETWORK_ERROR",
        undefined,
        method === "POST",
      );
    } finally {
      clearTimeout(timer);
    }
  }
  async dispatchApifyScrape(
    input: ApifyDispatchInput,
  ): Promise<ApifyDispatchResult> {
    const parsed = dispatchSchema.parse(input);
    const candidateLimit = apifyCandidateLimit(
      parsed.maxPlaces,
      parsed.leadTier,
    );
    if (!this.pool.size)
      throw new ApifyError("Apify tokens are not configured", "CONFIGURATION");
    const queries = [...new Set(parsed.searchStrings)].slice(0, candidateLimit);
    const budget = z.coerce
      .number()
      .positive()
      .max(100)
      .parse(process.env.APIFY_MAX_RUN_CHARGE_USD ?? "1");
    for (let attempt = 0; attempt < this.pool.size; attempt++) {
      const credential = this.pool.select();
      try {
        const response = await this.request(
          `/acts/compass~crawler-google-places/runs?maxTotalChargeUsd=${budget}`,
          credential.id,
          "POST",
          {
            searchStringsArray: queries,
            locationQuery: `${US_STATES.find((item) => item.code === parsed.stateCode)!.name}, USA`,
            maxCrawledPlacesPerSearch: Math.max(
              1,
              Math.ceil(candidateLimit / queries.length),
            ),
            language: "en",
            skipClosedPlaces: true,
            scrapePlaceDetailPage: true,
            // Website/social contact extraction is chargeable and strictly opt-in by purchased tier.
            // PHONE_ONLY (and untyped admin smoke tests) always stay Maps-only.
            scrapeContacts: parsed.leadTier === "VERIFIED_EMAIL",
            maxReviews: 0,
            maxImages: 0,
          },
        );
        const result = z.object({ data: runSchema }).safeParse(response);
        if (!result.success)
          throw new ApifyError(
            "Apify dispatch response was invalid",
            "INVALID_RESPONSE",
            undefined,
            true,
          );
        return {
          run: result.data.data,
          runReference: encodeApifyRun(credential.id, result.data.data.id),
        };
      } catch (error) {
        // Only an explicit authentication rejection proves no paid run was started.
        if (!(error instanceof ApifyError) || error.status !== 401) throw error;
      }
    }
    throw new ApifyError(
      "All configured Apify credentials were rejected",
      "ALL_TOKENS_EXHAUSTED",
      401,
    );
  }
  async getRun(reference: string): Promise<ApifyRun> {
    const cached = this.completedRuns.get(reference);
    if (cached) return cached;
    const { credentialId, runId } = decodeApifyRun(reference);
    const result = z
      .object({ data: runSchema })
      .safeParse(await this.request(`/actor-runs/${runId}`, credentialId));
    if (!result.success || result.data.data.id !== runId)
      throw new ApifyError(
        "Apify returned an inconsistent run",
        "INVALID_RESPONSE",
      );
    if (result.data.data.status === "SUCCEEDED") {
      if (this.completedRuns.size >= 100) this.completedRuns.clear();
      this.completedRuns.set(reference, result.data.data);
    }
    return result.data.data;
  }
  async getDatasetPage(reference: string, page: number, pageSize = 100) {
    z.number().int().min(1).max(100_000).parse(page);
    z.number().int().min(1).max(100).parse(pageSize);
    const run = await this.getRun(reference);
    if (run.status !== "SUCCEEDED")
      throw new ApifyError("Apify dataset is not complete", "HTTP_ERROR");
    const { credentialId } = decodeApifyRun(reference);
    const offset = (page - 1) * pageSize;
    const [rawMetadata, rawItems] = await Promise.all([
      this.request(`/datasets/${run.defaultDatasetId}`, credentialId),
      this.request(
        `/datasets/${run.defaultDatasetId}/items?format=json&offset=${offset}&limit=${pageSize}&clean=false`,
        credentialId,
      ),
    ]);
    const metadata = z
      .object({
        data: z.object({
          id: idSchema,
          itemCount: z.number().int().nonnegative(),
        }),
      })
      .safeParse(rawMetadata);
    if (!metadata.success || metadata.data.data.id !== run.defaultDatasetId)
      throw new ApifyError(
        "Apify dataset metadata is invalid",
        "INVALID_RESPONSE",
      );
    const total = metadata.data.data.itemCount;
    const data = z.array(z.record(z.unknown())).safeParse(rawItems);
    if (
      !data.success ||
      data.data.length !== Math.min(pageSize, Math.max(0, total - offset))
    )
      throw new ApifyError(
        "Apify dataset page is incomplete",
        "INVALID_RESPONSE",
      );
    return {
      page,
      total_pages: Math.ceil(total / pageSize),
      total_results: total,
      data: data.data,
    };
  }
}
export const dispatchApifyScrape = (input: ApifyDispatchInput) =>
  new CompassApifyClient().dispatchApifyScrape(input);
