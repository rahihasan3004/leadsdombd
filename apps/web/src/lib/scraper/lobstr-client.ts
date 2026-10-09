import { z } from "zod";

const API_URL = "https://api.lobstr.io/v1";
const GOOGLE_MAPS_CRAWLER = "4734d096159ef05210e0e1677e8be823";
const idSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[\w-]+$/);
const runSchema = z.object({
  id: idSchema,
  squid: z.string().optional(),
  status: z
    .string()
    .transform((value) => value.toUpperCase())
    .pipe(
      z.enum([
        "PENDING",
        "RUNNING",
        "UPLOADING",
        "PAUSED",
        "ABORTED",
        "DONE",
        "ERROR",
      ]),
    ),
  export_done: z.boolean().nullable().optional(),
  total_results: z.number().int().nonnegative().optional(),
  done_reason: z.string().nullable().optional(),
});
const resultsSchema = z.object({
  page: z.number().int().positive(),
  total_pages: z.number().int().nonnegative(),
  total_results: z.number().int().nonnegative(),
  data: z.array(z.record(z.unknown())),
});
const inputSchema = z.object({
  category: z.string().trim().min(1).max(120),
  state: z
    .string()
    .trim()
    .regex(/^[A-Z]{2}$/),
  city: z.string().trim().min(1).max(100).optional(),
  zipCode: z
    .string()
    .regex(/^\d{5}$/)
    .optional(),
  limit: z.number().int().min(1).max(10_000),
});

const balanceSchema = z.object({
  available: z.number().int().nonnegative(),
  consumed: z.number().int().nonnegative(),
  used_slots: z.number().int().nonnegative(),
  total_available_slots: z.number().int().nonnegative(),
  has_unpaid_bill: z.object({ status: z.boolean().optional() }).default({}),
});
export type LobstrBalance = z.infer<typeof balanceSchema>;

export type LobstrRun = z.infer<typeof runSchema>;
export type LobstrRecord = Record<string, unknown>;
export type ScrapeParameters = z.infer<typeof inputSchema>;
export type LobstrErrorCode =
  | "CONFIGURATION"
  | "HTTP_ERROR"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "INVALID_RESPONSE"
  | "UNKNOWN";
export type DispatchPhase =
  "CREATE_SQUID" | "CONFIGURE_SQUID" | "CREATE_TASKS" | "CREATE_RUN";
export class LobstrError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code: LobstrErrorCode = "UNKNOWN",
  ) {
    super(message);
    this.name = "LobstrError";
  }
}

/** Only CREATE_RUN can be an ambiguous chargeable dispatch; setup failures are safe to retry. */
export class LobstrDispatchError extends LobstrError {
  constructor(
    error: LobstrError,
    readonly phase: DispatchPhase,
    readonly squidId?: string,
  ) {
    super(error.message, error.status, error.code);
    this.name = "LobstrDispatchError";
  }
  get uncertain() {
    const rejected = [400, 401, 402, 403, 404, 422, 429].includes(
      this.status ?? 0,
    );
    return this.phase === "CREATE_RUN" && !rejected;
  }
  get retryable() {
    return (
      !this.uncertain &&
      (this.code === "TIMEOUT" ||
        this.code === "NETWORK_ERROR" ||
        this.status === 408 ||
        this.status === 429 ||
        (this.status ?? 0) >= 500)
    );
  }
}

/** Server-only client. Do not import into client components. */
export class LobstrClient {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;
  private readonly crawlerId: string;

  constructor(options: { fetcher?: typeof fetch; timeoutMs?: number } = {}) {
    const key = process.env.LOBSTR_API_KEY?.trim();
    if (!key)
      throw new LobstrError(
        "LOBSTR_API_KEY is not configured",
        undefined,
        "CONFIGURATION",
      );
    this.apiKey = key;
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 8_000;
    this.crawlerId = idSchema.parse(
      process.env.LOBSTR_GOOGLE_MAPS_CRAWLER_ID ?? GOOGLE_MAPS_CRAWLER,
    );
  }

  private async request(
    path: string,
    method: "GET" | "POST" = "GET",
    body?: unknown,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(`${API_URL}${path}`, {
        method,
        headers: {
          Authorization: `Token ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
        cache: "no-store",
        redirect: "error", // Never forward credentials to a redirect destination.
      });
      if (!response.ok) {
        // Never expose provider bodies: they may contain credentials or scraped PII.
        throw new LobstrError(
          `Lobstr request failed (HTTP ${response.status})`,
          response.status,
          "HTTP_ERROR",
        );
      }
      return (await response.json()) as unknown;
    } catch (error) {
      if (error instanceof LobstrError) throw error;
      throw new LobstrError(
        controller.signal.aborted
          ? "Lobstr request timed out"
          : "Lobstr request failed",
        undefined,
        controller.signal.aborted
          ? "TIMEOUT"
          : error instanceof SyntaxError
            ? "INVALID_RESPONSE"
            : "NETWORK_ERROR",
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private parse<T extends z.ZodTypeAny>(
    schema: T,
    value: unknown,
  ): z.output<T> {
    const parsed = schema.safeParse(value);
    if (!parsed.success)
      throw new LobstrError(
        "Lobstr returned an unexpected response shape",
        undefined,
        "INVALID_RESPONSE",
      );
    return parsed.data;
  }

  async triggerScrapeRun(
    parameters: ScrapeParameters,
    hooks: { onSquidCreated?: (id: string) => Promise<void> } = {},
  ): Promise<LobstrRun> {
    const input = inputSchema.parse(parameters);
    let phase: DispatchPhase = "CREATE_SQUID";
    let squidId: string | undefined;
    try {
      // Isolate tasks/settings per run; do not mutate a shared squid or replay its old tasks.
      const squid = this.parse(
        z.object({ id: idSchema }),
        await this.request("/squids", "POST", {
          crawler: this.crawlerId,
          name: `Fine Leads: ${input.city ? `${input.city}, ` : ""}${input.state}`,
        }),
      );
      squidId = squid.id;
      await hooks.onSquidCreated?.(squid.id);
      phase = "CONFIGURE_SQUID";
      await this.request(`/squids/${squid.id}`, "POST", {
        name: `Fine Leads: ${input.city ? `${input.city}, ` : ""}${input.state}`,
        params: {
          country: "United States",
          language: "English (United States)",
          max_results: input.limit,
          geo_match: true,
          category_match: true,
          skip_closed: true,
          functions: {
            extract_emails_from_website: true,
            collect_business_details: true,
            fetch_business_images: false,
          },
        },
        concurrency: 1,
        is_active: true,
        no_line_breaks: true,
        to_complete: false,
        export_unique_results: true,
      });
      const query = `${input.category} in ${input.city ? `${input.city}, ` : ""}${input.zipCode ? `ZIP ${input.zipCode}, ` : ""}${input.state}, United States`;
      phase = "CREATE_TASKS";
      await this.request("/tasks", "POST", {
        squid: squid.id,
        tasks: [
          {
            url: `https://www.google.com/maps/search/${encodeURIComponent(query)}`,
          },
        ],
      });
      // No automatic retry of chargeable POSTs: a lost response does not imply a failed dispatch.
      phase = "CREATE_RUN";
      const run = this.parse(
        runSchema,
        await this.request("/runs", "POST", { squid: squid.id }),
      );
      return { ...run, squid: squid.id };
    } catch (error) {
      if (!(error instanceof LobstrError)) throw error;
      throw new LobstrDispatchError(
        error instanceof LobstrError
          ? error
          : new LobstrError(
              "Lobstr dispatch response was invalid",
              undefined,
              "INVALID_RESPONSE",
            ),
        phase,
        squidId,
      );
    }
  }

  async getBalance(): Promise<LobstrBalance> {
    return this.parse(balanceSchema, await this.request("/user/balance"));
  }
  async abortRun(runId: string): Promise<void> {
    await this.request(`/runs/${idSchema.parse(runId)}/abort`, "POST");
  }
  async deactivateSquid(squidId: string): Promise<void> {
    await this.request(`/squids/${idSchema.parse(squidId)}`, "POST", {
      is_active: false,
    });
  }

  async getRunStatus(runId: string): Promise<LobstrRun> {
    const id = idSchema.parse(runId);
    const run = this.parse(runSchema, await this.request(`/runs/${id}`));
    if (run.id !== id) throw new LobstrError("Lobstr returned a different run");
    return run;
  }

  /** Fixed-size pages support durable per-row checkpoints without buffering 10k records. */
  async getRunResultsPage(runId: string, page: number, pageSize = 100) {
    const id = idSchema.parse(runId);
    z.number().int().positive().parse(page);
    z.number().int().min(1).max(100).parse(pageSize);
    const response = this.parse(
      resultsSchema,
      await this.request(
        `/results?run=${encodeURIComponent(id)}&page=${page}&page_size=${pageSize}`,
      ),
    );
    if (
      response.page !== page ||
      response.data.length > pageSize ||
      (response.data.length === 0 && page < response.total_pages)
    ) {
      throw new LobstrError("Lobstr returned inconsistent result pagination");
    }
    return response;
  }

  async getRunResults(
    runId: string,
    options: { limit?: number } = {},
  ): Promise<LobstrRecord[]> {
    const id = idSchema.parse(runId);
    const limit = z
      .number()
      .int()
      .min(1)
      .max(10_000)
      .parse(options.limit ?? 10_000);
    const run = await this.getRunStatus(id);
    if (run.status !== "DONE" || run.export_done !== true) {
      throw new LobstrError("Lobstr run/export is not complete");
    }
    const records: LobstrRecord[] = [];
    let expectedTotal: number | undefined;
    let expectedPages: number | undefined;
    const pageSize = Math.min(100, limit); // Fixed size: changing it between pages changes offsets.
    for (let page = 1; page <= 100; page++) {
      const response = this.parse(
        resultsSchema,
        await this.request(
          `/results?run=${encodeURIComponent(id)}&page=${page}&page_size=${pageSize}`,
        ),
      );
      if (
        response.page !== page ||
        response.data.length > pageSize ||
        (expectedTotal !== undefined &&
          response.total_results !== expectedTotal) ||
        (expectedPages !== undefined &&
          response.total_pages !== expectedPages) ||
        (response.data.length === 0 && page < response.total_pages)
      ) {
        throw new LobstrError("Lobstr returned inconsistent result pagination");
      }
      expectedTotal = response.total_results;
      expectedPages = response.total_pages;
      records.push(...response.data.slice(0, limit - records.length));
      if (records.length >= limit || page >= response.total_pages) {
        if (records.length < Math.min(limit, response.total_results)) {
          throw new LobstrError("Lobstr returned incomplete result pagination");
        }
        return records;
      }
    }
    throw new LobstrError("Lobstr result pagination exceeded the safety limit");
  }
}

// Lazy construction keeps builds/tests from requiring a live API key.
export const triggerScrapeRun = (input: ScrapeParameters) =>
  new LobstrClient().triggerScrapeRun(input);
export const getRunStatus = (runId: string) =>
  new LobstrClient().getRunStatus(runId);
export const getRunResults = (runId: string) =>
  new LobstrClient().getRunResults(runId);
