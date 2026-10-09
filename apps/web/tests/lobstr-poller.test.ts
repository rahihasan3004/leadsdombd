import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const worker = vi.hoisted(() => vi.fn());
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
  worker.mockReset().mockResolvedValue({ worked: false, status: "IDLE" });
});
afterEach(() => vi.unstubAllEnvs());
describe("authenticated Lobstr poller", () => {
  it("fails closed if the cron secret is missing", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(request())).status).toBe(503);
    expect(worker).not.toHaveBeenCalled();
  });
  it.each([undefined, "Bearer wrong", "Basic scheduler-secret"])(
    "rejects unauthorized scheduler %s",
    async (header) => {
      expect((await GET(request(header))).status).toBe(401);
      expect(worker).not.toHaveBeenCalled();
    },
  );
  it("allows authenticated GET/POST and disables response caching", async () => {
    const response = await POST(request("Bearer scheduler-secret"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(worker).toHaveBeenCalledOnce();
  });
  it("does not expose database/provider errors", async () => {
    worker.mockRejectedValue(new Error("DATABASE_URL=secret"));
    const response = await GET(request("Bearer scheduler-secret"));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("DATABASE_URL");
  });
});
