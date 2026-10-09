vi.mock("@/lib/scraper/parallel-dispatcher", () => ({
  maintainParallelCapacity: vi.fn().mockResolvedValue(undefined),
}));
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { worker, emails } = vi.hoisted(() => ({
  worker: vi.fn(),
  emails: vi.fn(),
}));
vi.mock("@/lib/email/order-emails", () => ({
  processPendingOrderEmails: emails,
}));
vi.mock("@/lib/scraper/order-fulfillment", () => ({
  processNextFulfillment: worker,
}));
import { GET, POST } from "../app/api/cron/lobstr-fulfillment/route";
const request = (token?: string) =>
  new Request("https://app.test/api/cron/lobstr-fulfillment", {
    headers: token ? { authorization: token } : {},
  });
beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "scheduler-secret");
  emails.mockReset().mockResolvedValue({ sent: 0, deferred: 0, skipped: 0 });
  worker.mockReset().mockResolvedValue({ worked: false, status: "IDLE" });
});
afterEach(() => vi.unstubAllEnvs());
describe("authenticated Lobstr poller", () => {
  it("fails closed if the cron secret is missing", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(request())).status).toBe(503);
    expect(worker).not.toHaveBeenCalled();
    expect(emails).not.toHaveBeenCalled();
  });
  it.each([undefined, "Bearer wrong", "Basic scheduler-secret"])(
    "rejects unauthorized scheduler %s",
    async (header) => {
      expect((await GET(request(header))).status).toBe(401);
      expect(worker).not.toHaveBeenCalled();
      expect(emails).not.toHaveBeenCalled();
    },
  );
  it("allows authenticated GET/POST and disables response caching", async () => {
    const response = await POST(request("Bearer scheduler-secret"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(worker).toHaveBeenCalledOnce();
    expect(emails).toHaveBeenCalledOnce();
  });
  it("does not expose database/provider errors", async () => {
    worker.mockRejectedValue(new Error("DATABASE_URL=secret"));
    const response = await GET(request("Bearer scheduler-secret"));
    expect(response.status).toBe(500);
    expect(emails).toHaveBeenCalledOnce();
    expect(JSON.stringify(await response.json())).not.toContain("DATABASE_URL");
  });
});

it("keeps idle scheduler success when the email retry scan fails", async () => {
  emails.mockRejectedValue(new Error("private provider failure"));
  const response = await GET(request("Bearer scheduler-secret"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    worked: false,
    steps: 1,
    outcomes: [{ status: "IDLE" }],
  });
});
