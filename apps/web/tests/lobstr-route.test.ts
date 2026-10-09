import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  trigger: vi.fn(),
  status: vi.fn(),
  results: vi.fn(),
  ingest: vi.fn(),
  find: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/admin-guard", () => ({ requireAdminApi: mocks.guard }));
vi.mock("@fine-leads/database", () => ({
  db: {
    auditLog: {
      findFirst: mocks.find,
      create: mocks.create,
      update: mocks.update,
    },
  },
}));
vi.mock("@/lib/scraper/lead-mapper", () => ({
  ingestLobstrLeads: mocks.ingest,
}));
vi.mock("@/lib/scraper/lobstr-client", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../src/lib/scraper/lobstr-client")>();
  return {
    ...original,
    LobstrClient: class {
      constructor() {
        if (!process.env.LOBSTR_API_KEY)
          throw new original.LobstrError("LOBSTR_API_KEY is not configured");
      }
      triggerScrapeRun = mocks.trigger;
      getRunStatus = mocks.status;
      getRunResults = mocks.results;
    },
  };
});
import { GET, POST } from "../app/api/admin/scraper/test-lobstr/route";
import { LobstrError } from "../src/lib/scraper/lobstr-client";
const params = {
  state: "TX",
  city: "Austin",
  category: "real estate agents",
  limit: 5,
};
const done = { id: "run-1", status: "DONE", export_done: true };
const summary = {
  totalFetched: 5,
  newlyIngested: 2,
  duplicatesSkipped: 1,
  closedPlacesDiscarded: 1,
  invalidRecordsDiscarded: 1,
};
const request = (
  query = "state=TX&city=Austin&limit=5",
  method = "POST",
  origin?: string,
) =>
  new NextRequest(`https://app.test/api/admin/scraper/test-lobstr?${query}`, {
    method,
    ...(origin ? { headers: { origin } } : {}),
  });
beforeEach(() => {
  vi.stubEnv("LOBSTR_API_KEY", "test-token");
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.guard.mockResolvedValue({
    user: { id: "admin-1", role: "ADMIN" },
    session: {},
  });
  mocks.trigger.mockResolvedValue(done);
  mocks.status.mockResolvedValue(done);
  mocks.results.mockResolvedValue([{ name: "A" }]);
  mocks.ingest.mockResolvedValue(summary);
  mocks.create.mockResolvedValue({ id: "audit-1" });
  mocks.update.mockResolvedValue({ id: "audit-1" });
  mocks.find.mockResolvedValue({
    id: "audit-1",
    details: { parameters: params },
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("protected Lobstr smoke-test route", () => {
  it.each([401, 403])(
    "blocks unauthorized/forbidden requests (%i) before any side effects",
    async (status) => {
      mocks.guard.mockResolvedValue(
        NextResponse.json({ error: "No access" }, { status }),
      );
      expect((await POST(request())).status).toBe(status);
      expect(mocks.trigger).not.toHaveBeenCalled();
      expect(mocks.create).not.toHaveBeenCalled();
    },
  );
  it("rejects cross-origin mutation requests", async () => {
    expect(
      (await POST(request(undefined, "POST", "https://evil.test"))).status,
    ).toBe(403);
    expect(mocks.trigger).not.toHaveBeenCalled();
  });
  it.each([
    "state=XX&city=Austin",
    "state=TX&city=",
    "state=TX&city=Austin&limit=101",
    "state=TX&city=Austin&limit=1.5",
    "state=TX&city=Austin&limit=0",
  ])("validates bounded inputs %s", async (query) => {
    expect((await POST(request(query))).status).toBe(400);
    expect(mocks.trigger).not.toHaveBeenCalled();
  });
  it("returns 503 when the API key is missing without starting/auditing a scrape", async () => {
    vi.stubEnv("LOBSTR_API_KEY", "");
    expect((await POST(request())).status).toBe(503);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("dispatches and ingests a completed run, persists the summary and returns counters", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      runId: "run-1",
      status: "INGESTED",
      ...summary,
    });
    expect(mocks.trigger).toHaveBeenCalledWith(params);
    expect(mocks.results).toHaveBeenCalledWith("run-1", { limit: 5 });
    expect(mocks.ingest).toHaveBeenCalledWith([{ name: "A" }], params);
    expect(mocks.update.mock.calls[1]![0]).toMatchObject({
      data: { details: { parameters: params, summary } },
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("defaults category/limit and normalizes state", async () => {
    await POST(request("state=tx&city=Austin"));
    expect(mocks.trigger).toHaveBeenCalledWith(params);
  });
  it("returns 202 with a resumable run ID instead of polling indefinitely", async () => {
    vi.useFakeTimers();
    const pending = { ...done, status: "RUNNING", export_done: false };
    mocks.trigger.mockResolvedValue(pending);
    mocks.status.mockResolvedValue(pending);
    const responseTask = POST(request());
    await vi.advanceTimersByTimeAsync(12_000);
    const response = await responseTask;
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      runId: "run-1",
      pending: true,
      resumeMethod: "POST",
      resumeUrl: "/api/admin/scraper/test-lobstr?runId=run-1",
    });
    expect(mocks.status).toHaveBeenCalledTimes(1);
    expect(mocks.ingest).not.toHaveBeenCalled();
  });
  it("does not ingest a DONE run until export is ready", async () => {
    vi.useFakeTimers();
    mocks.trigger.mockResolvedValue({ ...done, export_done: false });
    mocks.status.mockResolvedValue({ ...done, export_done: false });
    const task = POST(request());
    await vi.advanceTimersByTimeAsync(12_000);
    expect((await task).status).toBe(202);
    expect(mocks.results).not.toHaveBeenCalled();
  });
  it("reports aborted runs without ingesting partial results", async () => {
    mocks.trigger.mockResolvedValue({ ...done, status: "ABORTED" });
    expect((await POST(request())).status).toBe(502);
    expect(mocks.ingest).not.toHaveBeenCalled();
  });
  it("resumes using persisted inputs without dispatching/charging again", async () => {
    const response = await POST(request("runId=run-1&limit=100&state=CA"));
    expect(response.status).toBe(200);
    expect(mocks.trigger).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.results).toHaveBeenCalledWith("run-1", { limit: 5 });
    expect(mocks.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          resource: "LOBSTR_RUN",
          action: "LOBSTR_INGESTION",
          resourceId: "run-1",
          userId: "admin-1",
        },
      }),
    );
  });
  it("does not reimport a completed audited run", async () => {
    mocks.find.mockResolvedValue({
      id: "audit-1",
      details: { parameters: params, summary },
    });
    const response = await POST(request("runId=run-1"));
    expect(await response.json()).toMatchObject(summary);
    expect(mocks.results).not.toHaveBeenCalled();
    expect(mocks.ingest).not.toHaveBeenCalled();
  });
  it("refuses unknown/other-admin run IDs", async () => {
    mocks.find.mockResolvedValue(null);
    expect((await POST(request("runId=run-1"))).status).toBe(404);
    expect(mocks.status).not.toHaveBeenCalled();
  });
  it("keeps GET read-only and never dispatches or ingests", async () => {
    expect((await GET(request("state=TX&city=Austin", "GET"))).status).toBe(
      400,
    );
    const response = await GET(request("runId=run-1", "GET"));
    expect(await response.json()).toMatchObject({
      runId: "run-1",
      status: "DONE",
      exportReady: true,
    });
    expect(mocks.trigger).not.toHaveBeenCalled();
    expect(mocks.ingest).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("includes a resumable ID on ingestion failure without leaking DB details", async () => {
    mocks.ingest.mockRejectedValue(new Error("DATABASE_URL=secret"));
    const response = await POST(request());
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.runId).toBe("run-1");
    expect(JSON.stringify(body)).not.toContain("DATABASE_URL");
  });
  it("returns sanitized upstream errors", async () => {
    mocks.trigger.mockRejectedValue(
      new LobstrError("Lobstr request failed (HTTP 429)", 429),
    );
    expect((await POST(request())).status).toBe(502);
    expect(mocks.results).not.toHaveBeenCalled();
  });
});
