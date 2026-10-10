import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  run: vi.fn(),
  page: vi.fn(),
  lobstr: vi.fn(),
}));
vi.mock("@/lib/scraper/apify-client", async (original) => ({
  ...(await original<typeof import("@/lib/scraper/apify-client")>()),
  CompassApifyClient: class {
    dispatchApifyScrape = mocks.dispatch;
    getRun = mocks.run;
    getDatasetPage = mocks.page;
  },
}));
vi.mock("@/lib/scraper/lobstr-client", async (original) => ({
  ...(await original<typeof import("@/lib/scraper/lobstr-client")>()),
  LobstrClient: class {
    triggerScrapeRun = mocks.lobstr;
    getRunStatus = mocks.run;
    getRunResultsPage = mocks.page;
  },
}));
import {
  getFulfillmentClient,
  apifyProviderSelected,
} from "@/lib/scraper/scraper-provider";
import { fulfillmentConfigured } from "@/lib/scraper/fulfillment-policy";
import { ApifyError } from "@/lib/scraper/apify-token-pool";
import { LobstrError, LobstrDispatchError } from "@/lib/scraper/lobstr-client";
const reference = `apify:${"a".repeat(24)}:run_1`;
const input = {
  state: "TX",
  city: "Austin",
  category: "real estate agent",
  limit: 5,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.dispatch.mockResolvedValue({
    runReference: reference,
    run: { id: "run_1", status: "RUNNING", defaultDatasetId: "dataset_1" },
  });
  mocks.lobstr.mockResolvedValue({ id: "lobstr_1", status: "PENDING" });
});
afterEach(() => vi.unstubAllEnvs());
function configure() {
  vi.stubEnv("APIFY_TOKEN", "test-token");
  vi.stubEnv("APIFY_FULFILLMENT_ENABLED", "true");
}
describe("provider selection preserves financial and tier invariants", () => {
  it("enables Apify-only shortage fulfillment and skips Lobstr capacity plans", async () => {
    configure();
    vi.stubEnv("SCRAPER_PROVIDER", "apify");
    vi.stubEnv("LOBSTR_API_KEY", "");
    expect(fulfillmentConfigured()).toBe(true);
    expect(apifyProviderSelected()).toBe(true);
    const run = await getFulfillmentClient().triggerScrapeRun(input);
    expect(run).toMatchObject({ id: reference, status: "RUNNING" });
    expect(mocks.lobstr).not.toHaveBeenCalled();
  });
  it("requires both the enable flag and configured token", () => {
    vi.stubEnv("SCRAPER_PROVIDER", "apify");
    vi.stubEnv("APIFY_TOKEN", "");
    vi.stubEnv("APIFY_TOKENS", "");
    expect(fulfillmentConfigured()).toBe(false);
    expect(() => getFulfillmentClient()).toThrow("not configured");
  });
  it("polls persisted Apify runs even when the default provider changes", async () => {
    mocks.run.mockResolvedValue({
      id: "run_1",
      status: "SUCCEEDED",
      defaultDatasetId: "dataset_1",
    });
    vi.stubEnv("SCRAPER_PROVIDER", "lobstr");
    expect(
      await getFulfillmentClient(reference).getRunStatus(reference),
    ).toMatchObject({ id: reference, status: "DONE", export_done: true });
  });
  it("falls back only after a definitely rejected Lobstr dispatch", async () => {
    configure();
    vi.stubEnv("SCRAPER_FALLBACK_PROVIDER", "apify");
    mocks.lobstr.mockRejectedValue(
      new LobstrDispatchError(
        new LobstrError("Not found", 404, "HTTP_ERROR"),
        "CREATE_RUN",
      ),
    );
    expect((await getFulfillmentClient().triggerScrapeRun(input)).id).toBe(
      reference,
    );
    expect(mocks.dispatch).toHaveBeenCalledOnce();
  });
  it.each([402, 429, 500])(
    "does not switch providers to bypass quota/rate limits or ambiguous HTTP %s",
    async (status) => {
      configure();
      vi.stubEnv("SCRAPER_FALLBACK_PROVIDER", "apify");
      mocks.lobstr.mockRejectedValue(
        new LobstrDispatchError(
          new LobstrError("Rejected", status, "HTTP_ERROR"),
          "CREATE_RUN",
        ),
      );
      await expect(
        getFulfillmentClient().triggerScrapeRun(input),
      ).rejects.toBeInstanceOf(LobstrDispatchError);
      expect(mocks.dispatch).not.toHaveBeenCalled();
    },
  );
  it("marks an ambiguous Apify POST as uncertain for the durable worker", async () => {
    configure();
    vi.stubEnv("SCRAPER_PROVIDER", "apify");
    mocks.dispatch.mockRejectedValue(
      new ApifyError("Lost response", "NETWORK_ERROR", undefined, true),
    );
    await expect(
      getFulfillmentClient().triggerScrapeRun(input),
    ).rejects.toMatchObject({ uncertain: true });
  });
});
