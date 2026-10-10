import { describe, expect, it, vi } from "vitest";
import { CompassApifyClient, encodeApifyRun } from "@/lib/scraper/apify-client";
import { ApifyTokenPool } from "@/lib/scraper/apify-token-pool";
const json = (body: unknown) => new Response(JSON.stringify(body));
const completed = {
  id: "run_1",
  status: "SUCCEEDED",
  defaultDatasetId: "dataset_1",
};
describe("bounded Compass read optimization", () => {
  it("reuses a successful run and starts dataset metadata/items concurrently", async () => {
    const pool = new ApifyTokenPool(["test"]),
      reference = encodeApifyRun(pool.select().id, "run_1");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const paths: string[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const path = String(input);
      paths.push(path);
      if (path.includes("actor-runs")) return json({ data: completed });
      await gate;
      return path.includes("/items?")
        ? json([{ title: "Lead" }])
        : json({ data: { id: "dataset_1", itemCount: 1 } });
    });
    const client = new CompassApifyClient({ pool, fetcher });
    await client.getRun(reference);
    const page = client.getDatasetPage(reference, 1, 10);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(paths.filter((path) => path.includes("datasets"))).toHaveLength(2);
    release();
    expect((await page).data).toHaveLength(1);
    expect(paths.filter((path) => path.includes("actor-runs"))).toHaveLength(1);
  });
  it("never caches running states that could block later completion", async () => {
    const pool = new ApifyTokenPool(["test"]),
      reference = encodeApifyRun(pool.select().id, "run_1");
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json({ data: { ...completed, status: "RUNNING" } }),
      )
      .mockResolvedValueOnce(json({ data: completed }));
    const client = new CompassApifyClient({ pool, fetcher });
    expect((await client.getRun(reference)).status).toBe("RUNNING");
    expect((await client.getRun(reference)).status).toBe("SUCCEEDED");
    expect((await client.getRun(reference)).status).toBe("SUCCEEDED");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
