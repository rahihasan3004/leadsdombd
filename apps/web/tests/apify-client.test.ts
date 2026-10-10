import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApifyError,
  ApifyTokenPool,
  configuredApifyTokens,
  resetApifyTokenPool,
} from "@/lib/scraper/apify-token-pool";
import {
  CompassApifyClient,
  buildApifySearchStrings,
  encodeApifyRun,
} from "@/lib/scraper/apify-client";

const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), { status, headers });
const run = { id: "run_1", status: "RUNNING", defaultDatasetId: "dataset_1" };
const input = {
  searchStrings: ["Real estate agent in Austin, TX 78701"],
  maxPlaces: 5,
  stateCode: "TX",
};
afterEach(() => {
  vi.unstubAllEnvs();
  resetApifyTokenPool();
});
describe("authorized Apify token availability pool", () => {
  it("trims, deduplicates and rotates credentials synchronously", () => {
    const pool = new ApifyTokenPool([" one ", "two", "one", ""]);
    expect(pool.size).toBe(2);
    expect([
      pool.select().token,
      pool.select().token,
      pool.select().token,
    ]).toEqual(["one", "two", "one"]);
    expect(JSON.stringify(pool.snapshot())).not.toContain("one");
  });
  it("supports multi-token env with a single-token fallback", () => {
    vi.stubEnv("APIFY_TOKENS", " a, b ,,a ");
    vi.stubEnv("APIFY_TOKEN", "single");
    expect(configuredApifyTokens()).toEqual(["a", "b", "a"]);
    vi.stubEnv("APIFY_TOKENS", " , ");
    expect(configuredApifyTokens()).toEqual(["single"]);
  });
  it("disables explicit authentication failures and detects total exhaustion", () => {
    const pool = new ApifyTokenPool(["a", "b"]);
    const a = pool.select();
    pool.observeFailure(a.id, 401);
    const b = pool.select();
    pool.observeFailure(b.id, 401);
    expect(() => pool.select()).toThrow("All configured");
  });
  it("never rotates credentials to bypass a 402 quota failure", () => {
    const pool = new ApifyTokenPool(["a", "b"]);
    pool.observeFailure(pool.select().id, 402);
    expect(() => pool.select()).toThrow("quota exhausted");
    expect(pool.snapshot().quotaBlocked).toBe(true);
  });
  it("honors a shared rate-limit cooldown without exhausting tokens", () => {
    let now = 1000;
    const pool = new ApifyTokenPool(["a", "b"], () => now);
    pool.observeFailure(pool.select().id, 429, 20_000);
    expect(() => pool.select()).toThrow("cooldown");
    now += 20_000;
    expect(pool.select().token).toBe("b");
    expect(pool.snapshot().exhaustedCount).toBe(0);
  });
  it("pins a run to the same credential after token reordering", () => {
    const original = new ApifyTokenPool(["a", "b"]);
    const id = original.select().id;
    expect(new ApifyTokenPool(["b", "a"]).pinned(id).token).toBe("a");
    expect(() => new ApifyTokenPool(["b"]).pinned(id)).toThrow(
      "owning this Apify run",
    );
  });
});
describe("typed Compass REST runner", () => {
  it("can read an already-paid pinned run after quota exhaustion without allowing another dispatch", async () => {
    const pool = new ApifyTokenPool(["a", "b"]);
    const credential = pool.select();
    pool.observeFailure(credential.id, 402);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ data: run }));
    expect(
      (
        await new CompassApifyClient({ pool, fetcher }).getRun(
          encodeApifyRun(credential.id, "run_1"),
        )
      ).id,
    ).toBe("run_1");
    expect(() => pool.select()).toThrow("quota exhausted");
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer a",
    });
  });
  it("uses Retry-After to block subsequent starts without trying another token", async () => {
    const pool = new ApifyTokenPool(["a", "b"], () => 1000);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({}, 429, { "Retry-After": "90" }));
    const client = new CompassApifyClient({ pool, fetcher });
    await expect(client.dispatchApifyScrape(input)).rejects.toMatchObject({
      code: "RATE_LIMITED",
      retryAfterMs: 90_000,
    });
    await expect(client.dispatchApifyScrape(input)).rejects.toMatchObject({
      code: "RATE_LIMITED",
      retryAfterMs: 90_000,
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("dispatches the documented actor with an authorization header and bounded input", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ data: run }));
    const result = await new CompassApifyClient({
      pool: new ApifyTokenPool(["secret"]),
      fetcher,
    }).dispatchApifyScrape(input);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toContain(
      "/acts/compass~crawler-google-places/runs?maxTotalChargeUsd=1",
    );
    expect(String(url)).not.toContain("secret");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer secret" });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      searchStringsArray: input.searchStrings,
      maxCrawledPlacesPerSearch: 5,
      skipClosedPlaces: true,
      scrapeContacts: false,
      locationQuery: "Texas, USA",
    });
    expect(result.runReference).toMatch(/^apify:[a-f0-9]{24}:run_1$/);
    expect(result.runReference).not.toContain("secret");
  });
  it("fails over only after an explicit 401 rejection", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({ data: run }));
    await new CompassApifyClient({
      pool: new ApifyTokenPool(["a", "b"]),
      fetcher,
    }).dispatchApifyScrape(input);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer b",
    });
  });
  it.each([402, 429, 500])(
    "never redispatches a paid run after HTTP %s",
    async (status) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          json({ secret: "must-not-leak" }, status, { "Retry-After": "90" }),
        );
      await expect(
        new CompassApifyClient({
          pool: new ApifyTokenPool(["a", "b"]),
          fetcher,
        }).dispatchApifyScrape(input),
      ).rejects.toBeInstanceOf(ApifyError);
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it("treats a lost paid POST response as ambiguous, without retry", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("Network timeout secret"));
    await expect(
      new CompassApifyClient({
        pool: new ApifyTokenPool(["a", "b"]),
        fetcher,
      }).dispatchApifyScrape(input),
    ).rejects.toMatchObject({ uncertain: true, code: "NETWORK_ERROR" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("treats malformed successful dispatch output as ambiguous", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ data: { id: "run_1" } }));
    await expect(
      new CompassApifyClient({
        pool: new ApifyTokenPool(["a"]),
        fetcher,
      }).dispatchApifyScrape(input),
    ).rejects.toMatchObject({ uncertain: true, code: "INVALID_RESPONSE" });
  });
  it("returns a clean configuration error with no token", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      new CompassApifyClient({
        pool: new ApifyTokenPool([]),
        fetcher,
      }).dispatchApifyScrape(input),
    ).rejects.toMatchObject({ code: "CONFIGURATION" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("fetches a pinned completed dataset with exact, stable page bounds", async () => {
    const pool = new ApifyTokenPool(["a", "b"]);
    const reference = encodeApifyRun(pool.select().id, "run_1");
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ data: { ...run, status: "SUCCEEDED" } }))
      .mockResolvedValueOnce(json({ data: { id: "dataset_1", itemCount: 5 } }))
      .mockResolvedValueOnce(json([{ title: "last" }]));
    const page = await new CompassApifyClient({ pool, fetcher }).getDatasetPage(
      reference,
      3,
      2,
    );
    expect(page).toMatchObject({ page: 3, total_pages: 3, total_results: 5 });
    expect(String(fetcher.mock.calls[2]?.[0])).toContain(
      "offset=4&limit=2&clean=false",
    );
    expect(
      fetcher.mock.calls.every(
        ([, init]) =>
          (init?.headers as Record<string, string>).Authorization ===
          "Bearer a",
      ),
    ).toBe(true);
  });
  it("rejects incomplete dataset pages rather than advancing a cursor", async () => {
    const pool = new ApifyTokenPool(["a"]);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ data: { ...run, status: "SUCCEEDED" } }))
      .mockResolvedValueOnce(json({ data: { id: "dataset_1", itemCount: 5 } }))
      .mockResolvedValueOnce(json([]));
    await expect(
      new CompassApifyClient({ pool, fetcher }).getDatasetPage(
        encodeApifyRun(pool.select().id, "run_1"),
        1,
        5,
      ),
    ).rejects.toThrow("incomplete");
  });
  it("validates state and quantity before making an API request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new CompassApifyClient({
      pool: new ApifyTokenPool(["a"]),
      fetcher,
    });
    await expect(
      client.dispatchApifyScrape({ ...input, stateCode: "ZZ" }),
    ).rejects.toThrow();
    await expect(
      client.dispatchApifyScrape({ ...input, maxPlaces: 0 }),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("builds real city/ZIP queries from the territory registry", () => {
    expect(
      buildApifySearchStrings({
        stateCode: "TX",
        city: "Austin",
        zipCode: "78701",
      }),
    ).toEqual(["Real estate agent in Austin, TX 78701"]);
    expect(
      buildApifySearchStrings({
        stateCode: "MA",
        city: "Boston",
        maxQueries: 1,
      })[0],
    ).toMatch(/Boston, MA 0\d{4}$/);
    expect(() =>
      buildApifySearchStrings({ stateCode: "TX", city: "Atlantis" }),
    ).toThrow("City not found");
    expect(() =>
      buildApifySearchStrings({ stateCode: "TX", zipCode: "02108" }),
    ).toThrow("ZIP is not");
  });
});

it("VERIFIED_EMAIL enables website contacts and overscrapes the 20-candidate floor", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ data: run }));
  await new CompassApifyClient({
    pool: new ApifyTokenPool(["token"]),
    fetcher,
  }).dispatchApifyScrape({ ...input, leadTier: "VERIFIED_EMAIL" });
  expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toMatchObject({
    maxCrawledPlacesPerSearch: 20,
    scrapeContacts: true,
  });
});
it("rounds capacity up across multiple searches so total capacity never undercuts the buffer", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ data: run }));
  await new CompassApifyClient({
    pool: new ApifyTokenPool(["token"]),
    fetcher,
  }).dispatchApifyScrape({
    ...input,
    maxPlaces: 11,
    searchStrings: ["Agent Austin", "Agent Dallas", "Agent Houston"],
    leadTier: "VERIFIED_EMAIL",
  });
  expect(
    JSON.parse(String(fetcher.mock.calls[0]![1]?.body))
      .maxCrawledPlacesPerSearch,
  ).toBe(8);
});
