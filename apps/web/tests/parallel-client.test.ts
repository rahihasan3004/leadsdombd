import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LobstrClient } from "../src/lib/scraper/lobstr-client";
beforeEach(() => vi.stubEnv("LOBSTR_API_KEY", "test-only-key"));
afterEach(() => vi.unstubAllEnvs());
const json = (value: unknown) =>
  new Response(JSON.stringify(value), { status: 200 });
describe("parallel provider client contracts", () => {
  it("reads account credit and active slot capacity from the documented endpoint", async () => {
    const balance = {
      available: 10000,
      consumed: 100,
      used_slots: 2,
      total_available_slots: 10,
      has_unpaid_bill: {},
    };
    const fetcher = vi.fn().mockResolvedValue(json(balance));
    expect(await new LobstrClient({ fetcher }).getBalance()).toEqual(balance);
    expect(fetcher.mock.calls[0]![0]).toBe(
      "https://api.lobstr.io/v1/user/balance",
    );
  });
  it("recognizes an outstanding invoice and rejects malformed credit capacity", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          available: 1000,
          consumed: 0,
          used_slots: 0,
          total_available_slots: 10,
          has_unpaid_bill: { status: true, created_on: "2026-01-01" },
        }),
      )
      .mockResolvedValueOnce(json({ available: -1 }));
    const client = new LobstrClient({ fetcher });
    expect((await client.getBalance()).has_unpaid_bill.status).toBe(true);
    await expect(client.getBalance()).rejects.toThrow(
      "unexpected response shape",
    );
  });
  it("persists the Squid before a chargeable request and creates one-slot ZIP-specific tasks", async () => {
    let persisted = false;
    const fetcher = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("/squids")) return json({ id: "squid-test" });
      if (url.endsWith("/runs")) {
        expect(persisted).toBe(true);
        return json({ id: "run-test", status: "PENDING" });
      }
      return json({});
    });
    await new LobstrClient({ fetcher }).triggerScrapeRun(
      {
        category: "real estate agents",
        state: "TX",
        zipCode: "78701",
        limit: 100,
      },
      {
        onSquidCreated: async (id) => {
          expect(id).toBe("squid-test");
          persisted = true;
        },
      },
    );
    const calls = fetcher.mock.calls as Array<[string, RequestInit]>;
    const settings = JSON.parse(
      String(
        calls.find(([url]) => url.endsWith("/squids/squid-test"))![1].body,
      ),
    );
    expect(settings).toMatchObject({
      concurrency: 1,
      is_active: true,
      params: { max_results: 100 },
    });
    const task = JSON.parse(
      String(calls.find(([url]) => url.endsWith("/tasks"))![1].body),
    );
    expect(decodeURIComponent(task.tasks[0].url)).toContain("ZIP 78701, TX");
    expect(calls.filter(([url]) => url.endsWith("/runs"))).toHaveLength(1);
  });
  it("does not dispatch a paid run after Squid persistence fails", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ id: "squid-test" }));
    await expect(
      new LobstrClient({ fetcher }).triggerScrapeRun(
        { category: "agents", state: "TX", limit: 100 },
        {
          onSquidCreated: async () => {
            throw new Error("lease lost");
          },
        },
      ),
    ).rejects.toThrow("lease lost");
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("deactivates only the known Squid and aborts only the known run", async () => {
    const fetcher = vi.fn().mockImplementation(async () => json({}));
    const client = new LobstrClient({ fetcher });
    await client.deactivateSquid("sq-1");
    await client.abortRun("run-1");
    expect(fetcher.mock.calls[0]![0]).toBe(
      "https://api.lobstr.io/v1/squids/sq-1",
    );
    expect(JSON.parse(String(fetcher.mock.calls[0]![1].body))).toEqual({
      is_active: false,
    });
    expect(fetcher.mock.calls[1]![0]).toBe(
      "https://api.lobstr.io/v1/runs/run-1/abort",
    );
  });
});
