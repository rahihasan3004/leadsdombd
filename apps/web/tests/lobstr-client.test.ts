import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LobstrClient } from "../src/lib/scraper/lobstr-client";

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const done = {
  id: "run-1",
  status: "done",
  export_done: true,
  total_results: 1,
};
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
beforeEach(() => {
  vi.stubEnv("LOBSTR_API_KEY", "secret-test-token");
  fetcher = vi.fn<typeof fetch>();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
const client = () => new LobstrClient({ fetcher });

describe("Lobstr typed HTTP client", () => {
  it("requires a server-side API key lazily", () => {
    vi.stubEnv("LOBSTR_API_KEY", " ");
    expect(client).toThrow("LOBSTR_API_KEY is not configured");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("creates/configures an isolated squid, adds a URL task, then dispatches", async () => {
    fetcher
      .mockResolvedValueOnce(reply({ id: "squid-1" }))
      .mockResolvedValueOnce(reply({ id: "squid-1" }))
      .mockResolvedValueOnce(reply({ tasks: [{ id: "task-1" }] }))
      .mockResolvedValueOnce(reply({ id: "run-1", status: "pending" }));
    const run = await client().triggerScrapeRun({
      state: "TX",
      city: "Austin",
      category: "real estate agents",
      limit: 5,
    });
    expect(run).toMatchObject({
      id: "run-1",
      squid: "squid-1",
      status: "PENDING",
    });
    expect(fetcher.mock.calls.map(([path]) => path)).toEqual([
      "https://api.lobstr.io/v1/squids",
      "https://api.lobstr.io/v1/squids/squid-1",
      "https://api.lobstr.io/v1/tasks",
      "https://api.lobstr.io/v1/runs",
    ]);
    const settings = JSON.parse(fetcher.mock.calls[1]![1]!.body as string);
    expect(settings.params).toMatchObject({
      max_results: 5,
      geo_match: true,
      skip_closed: true,
    });
    const task = JSON.parse(fetcher.mock.calls[2]![1]!.body as string);
    expect(task.tasks[0].url).toContain(
      "real%20estate%20agents%20in%20Austin%2C%20TX",
    );
    for (const [, init] of fetcher.mock.calls) {
      expect(init).toMatchObject({
        method: "POST",
        redirect: "error",
        cache: "no-store",
        headers: { Authorization: "Token secret-test-token" },
      });
    }
  });
  it("rejects bad inputs before any paid API call", async () => {
    await expect(
      client().triggerScrapeRun({
        state: "Texas",
        city: "Austin",
        category: "agents",
        limit: 5,
      }),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("checks status without relying on is_done", async () => {
    fetcher.mockResolvedValue(reply(done));
    expect(await client().getRunStatus("run-1")).toMatchObject({
      status: "DONE",
      export_done: true,
    });
  });
  it("rejects a different run ID", async () => {
    fetcher.mockResolvedValue(reply({ ...done, id: "another-run" }));
    await expect(client().getRunStatus("run-1")).rejects.toThrow(
      "different run",
    );
  });
  it.each(["pending", "running", "uploading", "paused", "aborted", "error"])(
    "does not fetch results for %s",
    async (status) => {
      fetcher.mockResolvedValue(reply({ ...done, status }));
      await expect(client().getRunResults("run-1")).rejects.toThrow(
        "not complete",
      );
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it("waits for completed exports even when execution is DONE", async () => {
    fetcher.mockResolvedValue(reply({ ...done, export_done: false }));
    await expect(client().getRunResults("run-1")).rejects.toThrow(
      "not complete",
    );
  });
  it("paginates by run alone with a stable page size", async () => {
    fetcher
      .mockResolvedValueOnce(reply(done))
      .mockResolvedValueOnce(
        reply({
          page: 1,
          total_pages: 2,
          total_results: 150,
          data: Array.from({ length: 100 }, (_, id) => ({ id })),
        }),
      )
      .mockResolvedValueOnce(
        reply({
          page: 2,
          total_pages: 2,
          total_results: 150,
          data: Array.from({ length: 50 }, (_, id) => ({ id: id + 100 })),
        }),
      );
    const rows = await client().getRunResults("run-1", { limit: 150 });
    expect(rows).toHaveLength(150);
    expect(rows[100]).toEqual({ id: 100 });
    expect(fetcher.mock.calls[1]![0]).toBe(
      "https://api.lobstr.io/v1/results?run=run-1&page=1&page_size=100",
    );
    expect(fetcher.mock.calls[2]![0]).toBe(
      "https://api.lobstr.io/v1/results?run=run-1&page=2&page_size=100",
    );
  });
  it("caps returned records to the requested limit", async () => {
    fetcher
      .mockResolvedValueOnce(reply(done))
      .mockResolvedValueOnce(
        reply({
          page: 1,
          total_pages: 20,
          total_results: 100,
          data: [{ id: 1 }, { id: 2 }],
        }),
      );
    expect(await client().getRunResults("run-1", { limit: 2 })).toHaveLength(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("supports a genuinely empty completed run", async () => {
    fetcher
      .mockResolvedValueOnce(reply(done))
      .mockResolvedValueOnce(
        reply({ page: 1, total_pages: 0, total_results: 0, data: [] }),
      );
    expect(await client().getRunResults("run-1")).toEqual([]);
  });
  it("rejects malformed API payloads", async () => {
    fetcher.mockResolvedValue(reply({ id: "run-1", status: "mystery" }));
    await expect(client().getRunStatus("run-1")).rejects.toThrow(
      "unexpected response shape",
    );
  });
  it("rejects inconsistent page numbering", async () => {
    fetcher
      .mockResolvedValueOnce(reply(done))
      .mockResolvedValueOnce(
        reply({ page: 9, total_pages: 9, total_results: 1, data: [{}] }),
      );
    await expect(client().getRunResults("run-1")).rejects.toThrow(
      "inconsistent",
    );
  });
  it("rejects missing records instead of silently ingesting a partial page", async () => {
    fetcher
      .mockResolvedValueOnce(reply(done))
      .mockResolvedValueOnce(
        reply({ page: 1, total_pages: 1, total_results: 2, data: [{}] }),
      );
    await expect(client().getRunResults("run-1")).rejects.toThrow(
      "incomplete result pagination",
    );
  });
  it("does not expose provider bodies or retry POSTs on failure", async () => {
    fetcher.mockResolvedValue(
      reply({ secret: "secret-test-token", email: "private@example.com" }, 429),
    );
    await expect(
      client().triggerScrapeRun({
        state: "TX",
        city: "Austin",
        category: "agents",
        limit: 5,
      }),
    ).rejects.toThrow("HTTP 429");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("aborts slow upstream calls with a sanitized timeout", async () => {
    vi.useFakeTimers();
    fetcher.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init!.signal!.addEventListener("abort", () =>
            reject(new Error("private timeout")),
          );
        }),
    );
    const task = new LobstrClient({ fetcher, timeoutMs: 50 }).getRunStatus(
      "run-1",
    );
    const assertion = expect(task).rejects.toThrow("Lobstr request timed out");
    await vi.advanceTimersByTimeAsync(51);
    await assertion;
  });
});

it("supports a state-wide order search without fabricating a city", async () => {
  fetcher
    .mockResolvedValueOnce(reply({ id: "squid-1" }))
    .mockResolvedValueOnce(reply({}))
    .mockResolvedValueOnce(reply({}))
    .mockResolvedValueOnce(reply({ id: "run-1", status: "pending" }));
  await client().triggerScrapeRun({
    state: "TX",
    category: "real estate agents",
    limit: 50,
  });
  const task = JSON.parse(fetcher.mock.calls[2]![1]!.body as string);
  expect(decodeURIComponent(task.tasks[0].url)).toContain(
    "real estate agents in TX, United States",
  );
  expect(task.tasks[0].url).not.toContain("undefined");
});

it("exposes fixed-size result pages for durable ingestion checkpoints", async () => {
  fetcher.mockResolvedValue(
    reply({
      page: 2,
      total_pages: 2,
      total_results: 101,
      data: [{ name: "Final" }],
    }),
  );
  expect((await client().getRunResultsPage("run-1", 2)).data).toHaveLength(1);
  expect(fetcher.mock.calls[0]![0]).toBe(
    "https://api.lobstr.io/v1/results?run=run-1&page=2&page_size=100",
  );
});
