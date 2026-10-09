import { describe, expect, it } from "vitest";
import {
  freshInventoryWhere,
  planFulfillmentRuns,
  isSmtpDeliverable,
} from "../src/lib/scraper/fulfillment-policy";
const result = {
  email: "sales@example.com",
  status: "deliverable",
  isDeliverable: true,
  isCatchAll: false,
  isDisposable: false,
  smtpCode: 250,
};
describe("fulfillment policy", () => {
  it("enforces freshness and per-user ownership alongside tier eligibility", () => {
    const where = freshInventoryWhere(
      "u1",
      ["TX"],
      "VERIFIED_EMAIL",
      new Date("2026-10-09T00:00:00Z"),
    );
    expect(where).toMatchObject({
      isDeliverable: true,
      emailStatus: { in: ["validated", "deliverable"] },
      unlockedBy: { none: { userId: "u1" } },
      state: { in: ["TX"] },
    });
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { scrapedAt: { gte: new Date("2026-07-11T00:00:00Z") } },
      ]),
    );
  });
  it("distributes shortages without exceeding per-run limits", () => {
    const plan = planFulfillmentRuns(["CA", "TX", "NY"], 50_000);
    expect(plan.reduce((sum, run) => sum + run.targetQuantity, 0)).toBe(50_000);
    expect(
      plan.every(
        (run) => run.targetQuantity > 0 && run.targetQuantity <= 10_000,
      ),
    ).toBe(true);
    expect(new Set(plan.map((run) => run.state)).size).toBe(3);
  });
  it("does not dispatch zero-quantity runs when there are more states than requested leads", () => {
    expect(planFulfillmentRuns(["CA", "TX", "NY"], 1)).toEqual([
      { state: "CA", targetQuantity: 1 },
    ]);
  });
  it.each([0, -1, 0.5])("rejects invalid shortage %s", (quantity) => {
    expect(() => planFulfillmentRuns(["TX"], quantity)).toThrow();
  });
  it("accepts only a matching, positive SMTP deliverability result", () => {
    expect(isSmtpDeliverable(result, "SALES@example.com")).toBe(true);
  });
  it.each([
    { status: "mx_verified" },
    { status: "valid" },
    { smtpCode: null },
    { smtpCode: 550 },
    { isCatchAll: true },
    { isDisposable: true },
    { isDeliverable: false },
    { email: "other@example.com" },
  ])("rejects unqualified verification %j", (change) => {
    expect(isSmtpDeliverable({ ...result, ...change }, result.email)).toBe(
      false,
    );
  });
});
