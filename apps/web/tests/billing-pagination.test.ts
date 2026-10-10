import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  db: {
    walletTransaction: { findMany: vi.fn(), count: vi.fn() },
    leadPurchase: { findMany: vi.fn() },
  },
}));
vi.mock("@fine-leads/auth", () => ({ auth: mocks.auth }));
vi.mock("@fine-leads/database", () => ({ db: mocks.db }));
import { GET } from "../app/api/billing/transactions/route";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "u1" } });
  mocks.db.walletTransaction.findMany.mockResolvedValue([]);
  mocks.db.walletTransaction.count.mockResolvedValue(120);
});
describe("Billing history pagination", () => {
  it("can reach ledger entries beyond the old 50-row cutoff", async () => {
    const response = await GET(
      new Request("https://app.test/api/billing/transactions?page=12&limit=5"),
    );
    expect((await response.json()).pagination).toMatchObject({
      total: 120,
      pages: 24,
      page: 12,
    });
    expect(mocks.db.walletTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 55, take: 5, where: { userId: "u1" } }),
    );
  });
  it("rejects malformed page input", async () => {
    expect(
      (
        await GET(
          new Request("https://app.test/api/billing/transactions?page=-1"),
        )
      ).status,
    ).toBe(400);
    expect(mocks.db.walletTransaction.findMany).not.toHaveBeenCalled();
  });
  it("does not read ledger data without authentication", async () => {
    mocks.auth.mockResolvedValue(null);
    expect(
      (await GET(new Request("https://app.test/api/billing/transactions")))
        .status,
    ).toBe(401);
    expect(mocks.db.walletTransaction.count).not.toHaveBeenCalled();
  });
});
