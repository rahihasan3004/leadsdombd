import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  rate: vi.fn(),
  dispatch: vi.fn(),
  run: vi.fn(),
  page: vi.fn(),
  ingest: vi.fn(),
}));
vi.mock("@/lib/admin-guard", () => ({ requireAdminApi: mocks.admin }));
vi.mock("@fine-leads/utils/rate-limit", () => ({ checkRateLimit: mocks.rate }));
vi.mock("@/lib/scraper/apify-client", async (original) => ({
  ...(await original<typeof import("@/lib/scraper/apify-client")>()),
  CompassApifyClient: class {
    dispatchApifyScrape = mocks.dispatch;
    getRun = mocks.run;
    getDatasetPage = mocks.page;
  },
}));
vi.mock("@/lib/scraper/apify-mapper", () => ({
  ingestApifyLeads: mocks.ingest,
}));
import { POST } from "../app/api/admin/scraper/test-apify/route";
import { ApifyError } from "@/lib/scraper/apify-token-pool";
const reference = `apify:${"a".repeat(24)}:run_1`;
const request = (query = "state=TX&city=Austin&limit=5") =>
  new NextRequest(`https://app.test/api/admin/scraper/test-apify?${query}`, {
    method: "POST",
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.admin.mockResolvedValue({ user: { id: "admin" } });
  mocks.rate.mockResolvedValue({ allowed: true, resetAt: Date.now() + 60_000 });
  mocks.dispatch.mockResolvedValue({
    runReference: reference,
    run: { id: "run_1", defaultDatasetId: "dataset_1", status: "RUNNING" },
  });
  mocks.run.mockResolvedValue({
    id: "run_1",
    defaultDatasetId: "dataset_1",
    status: "SUCCEEDED",
  });
  mocks.page.mockResolvedValue({ data: [{ title: "Lead" }] });
  mocks.ingest.mockResolvedValue({
    totalFetched: 1,
    newlyIngested: 1,
    duplicatesSkipped: 0,
    closedPlacesDiscarded: 0,
    invalidRecordsDiscarded: 0,
  });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());
describe("protected Apify admin POST smoke test", () => {
  it.each([401, 403])(
    "never dispatches for a rejected admin (%s)",
    async (status) => {
      mocks.admin.mockResolvedValue(
        NextResponse.json({ error: "Denied" }, { status }),
      );
      expect((await POST(request())).status).toBe(status);
      expect(mocks.dispatch).not.toHaveBeenCalled();
    },
  );
  it.each([
    "state=ZZ&city=Austin",
    "state=TX&city=Atlantis",
    "state=TX&city=Austin&limit=0",
    "state=TX&city=Austin&limit=26",
    "state=TX&city=Austin&runReference=bad",
  ])("rejects invalid test input %s", async (query) => {
    expect((await POST(request(query))).status).toBe(400);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
  it("returns a pollable 202 instead of timing out or repeating a paid start", async () => {
    const response = await POST(request());
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      runReference: reference,
      status: "RUNNING",
    });
    expect(mocks.dispatch).toHaveBeenCalledOnce();
    expect(mocks.dispatch.mock.calls[0]?.[0]).toMatchObject({
      maxPlaces: 5,
      stateCode: "TX",
    });
    expect(mocks.ingest).not.toHaveBeenCalled();
  });
  it("polls and ingests the same completed run without starting another", async () => {
    const response = await POST(
      request(`state=TX&city=Austin&limit=5&runReference=${reference}`),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      scraped: 1,
      inserted: 1,
      skipped: 0,
    });
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(mocks.page).toHaveBeenCalledWith(reference, 1, 5);
    expect(mocks.ingest).toHaveBeenCalledWith([{ title: "Lead" }], {
      state: "TX",
      city: "Austin",
      category: "real estate agents",
    });
  });
  it("rate-limits paid starts before any provider call", async () => {
    mocks.rate.mockResolvedValue({
      allowed: false,
      resetAt: Date.now() + 60_000,
    });
    expect((await POST(request())).status).toBe(429);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
  it("returns sanitized provider errors without leaking credentials", async () => {
    mocks.dispatch.mockRejectedValue(
      new ApifyError("Apify quota exhausted", "QUOTA_EXHAUSTED", 402),
    );
    expect((await POST(request())).status).toBe(402);
    expect(mocks.ingest).not.toHaveBeenCalled();
  });
});
