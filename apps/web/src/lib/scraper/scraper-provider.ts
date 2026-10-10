import {
  CompassApifyClient,
  buildApifySearchStrings,
  type ApifyRun,
} from "./apify-client";
import { ApifyError, configuredApifyTokens } from "./apify-token-pool";
import {
  LobstrClient,
  LobstrError,
  LobstrDispatchError,
  type LobstrRun,
  type ScrapeParameters,
} from "./lobstr-client";

export function apifyFulfillmentConfigured(): boolean {
  return (
    process.env.APIFY_FULFILLMENT_ENABLED === "true" &&
    configuredApifyTokens().length > 0
  );
}
/** New Apify/fallback orders use the durable serial runner, not Lobstr-specific capacity slots. */
export function apifyProviderSelected(): boolean {
  return (
    apifyFulfillmentConfigured() &&
    (process.env.SCRAPER_PROVIDER === "apify" ||
      process.env.SCRAPER_FALLBACK_PROVIDER === "apify")
  );
}
type FulfillmentClient = Pick<
  LobstrClient,
  "triggerScrapeRun" | "getRunStatus" | "getRunResultsPage"
>;
function asLobstrError(error: unknown) {
  return error instanceof ApifyError
    ? new LobstrError(
        error.message,
        error.status,
        error.code === "CONFIGURATION"
          ? "CONFIGURATION"
          : error.code === "NETWORK_ERROR"
            ? "NETWORK_ERROR"
            : "HTTP_ERROR",
      )
    : new LobstrError(
        "Invalid Apify input or response",
        400,
        "INVALID_RESPONSE",
      );
}
function normalizedRun(run: ApifyRun, reference: string): LobstrRun {
  return {
    id: reference,
    status:
      run.status === "SUCCEEDED"
        ? "DONE"
        : ["FAILED", "TIMED-OUT"].includes(run.status)
          ? "ERROR"
          : run.status === "ABORTED"
            ? "ABORTED"
            : "RUNNING",
    export_done: run.status === "SUCCEEDED",
  };
}
export class ApifyFulfillmentClient implements FulfillmentClient {
  constructor(private readonly client = new CompassApifyClient()) {}
  async triggerScrapeRun(input: ScrapeParameters): Promise<LobstrRun> {
    try {
      const { run, runReference } = await this.client.dispatchApifyScrape({
        searchStrings: buildApifySearchStrings({
          stateCode: input.state,
          category: input.category,
          city: input.city,
          zipCode: input.zipCode,
          maxQueries: Math.min(20, input.limit),
        }),
        maxPlaces: input.limit,
        stateCode: input.state,
      });
      return normalizedRun(run, runReference);
    } catch (error) {
      const wrapped = asLobstrError(error);
      // Unknown/invalid POST responses are ambiguous chargeable dispatches, never retried.
      throw new LobstrDispatchError(
        error instanceof ApifyError && error.uncertain
          ? new LobstrError(error.message, undefined, wrapped.code)
          : wrapped,
        "CREATE_RUN",
      );
    }
  }
  async getRunStatus(reference: string): Promise<LobstrRun> {
    try {
      return normalizedRun(await this.client.getRun(reference), reference);
    } catch (error) {
      throw asLobstrError(error);
    }
  }
  async getRunResultsPage(reference: string, page: number, pageSize = 100) {
    try {
      return await this.client.getDatasetPage(reference, page, pageSize);
    } catch (error) {
      throw asLobstrError(error);
    }
  }
}
class SafeFallbackClient implements FulfillmentClient {
  async triggerScrapeRun(input: ScrapeParameters): Promise<LobstrRun> {
    try {
      return await new LobstrClient().triggerScrapeRun(input);
    } catch (error) {
      const safe =
        error instanceof LobstrDispatchError
          ? !error.uncertain && ![402, 429].includes(error.status ?? 0)
          : error instanceof LobstrError && error.code === "CONFIGURATION";
      if (!safe) throw error;
      return new ApifyFulfillmentClient().triggerScrapeRun(input);
    }
  }
  getRunStatus(id: string) {
    return getFulfillmentClient(id).getRunStatus(id);
  }
  getRunResultsPage(id: string, page: number, size = 100) {
    return getFulfillmentClient(id).getRunResultsPage(id, page, size);
  }
}
export function getFulfillmentClient(
  runReference?: string | null,
): FulfillmentClient {
  if (runReference)
    return runReference.startsWith("apify:")
      ? new ApifyFulfillmentClient()
      : new LobstrClient();
  if (process.env.SCRAPER_PROVIDER === "apify") {
    if (!apifyFulfillmentConfigured())
      throw new LobstrError(
        "Apify fulfillment is not configured",
        undefined,
        "CONFIGURATION",
      );
    return new ApifyFulfillmentClient();
  }
  if (
    process.env.SCRAPER_FALLBACK_PROVIDER === "apify" &&
    apifyFulfillmentConfigured()
  )
    return new SafeFallbackClient();
  return new LobstrClient();
}
