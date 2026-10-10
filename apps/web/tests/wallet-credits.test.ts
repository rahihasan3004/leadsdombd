import { afterEach, describe, it, expect, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import {
  normalizeCreditBalance,
  formatCreditBalance,
  fetchCreditBalance,
  walletCreditQueryOptions,
} from "@/lib/wallet-credits";
afterEach(() => vi.unstubAllGlobals());
describe("Authenticated sidebar credit balance", () => {
  it("formats credits deterministically and never confuses unknown with zero", () => {
    expect(formatCreditBalance(51877)).toBe("51,877");
    expect(formatCreditBalance(0)).toBe("0");
    for (const value of [
      undefined,
      null,
      NaN,
      Infinity,
      -1,
      1.5,
      "25",
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      expect(normalizeCreditBalance(value)).toBeNull();
      expect(formatCreditBalance(value)).toBe("—");
    }
  });
  it("fetches the authenticated lightweight endpoint without caching or user-supplied account IDs", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ credits: 51877 })));
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    expect(await fetchCreditBalance(controller.signal)).toBe(51877);
    expect(fetcher).toHaveBeenCalledWith("/api/user/profile", {
      signal: controller.signal,
      cache: "no-store",
    });
  });
  it.each([401, 500])(
    "does not fabricate credits on HTTP %s errors",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response("failure", { status })),
      );
      await expect(fetchCreditBalance()).rejects.toThrow("Unable to refresh");
    },
  );
  it("rejects malformed balance data rather than displaying a bogus zero", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ walletBalance: 25 }))),
    );
    await expect(fetchCreditBalance()).rejects.toThrow("Invalid credit");
  });
  it("uses account-scoped wallet keys and bounded foreground refresh", () => {
    const options = walletCreditQueryOptions("user", 0);
    expect(options.queryKey).toEqual(["wallet", "credits", "user"]);
    expect(options.initialData).toBe(0);
    expect(options.refetchInterval).toBe(60000);
    expect(options.refetchIntervalInBackground).toBe(false);
    expect(options.refetchOnWindowFocus).toBe(true);
    expect(walletCreditQueryOptions().enabled).toBe(false);
    expect(walletCreditQueryOptions("other").queryKey).not.toEqual(
      options.queryKey,
    );
  });
  it("refreshes immediately on existing wallet invalidations after purchases/top-ups", async () => {
    const client = new QueryClient();
    const fetcher = vi
      .fn()
      .mockImplementation(
        async () => new Response(JSON.stringify({ credits: 20 })),
      );
    vi.stubGlobal("fetch", fetcher);
    const observer = new QueryObserver(
      client,
      walletCreditQueryOptions("user", 25),
    );
    const unsubscribe = observer.subscribe(() => undefined);
    try {
      await observer.refetch();
      expect(observer.getCurrentResult().data).toBe(20);
      fetcher.mockImplementation(
        async () => new Response(JSON.stringify({ credits: 7 })),
      );
      await client.invalidateQueries({ queryKey: ["wallet"] });
      expect(observer.getCurrentResult().data).toBe(7);
    } finally {
      unsubscribe();
      client.clear();
    }
  });
});
