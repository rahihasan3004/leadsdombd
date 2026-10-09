import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  createParallelPlan,
  nextBackupZip,
  availableProviderCapacity,
  parallelFulfillmentEnabled,
} from "../src/lib/scraper/parallel-plan";
beforeEach(() => {
  vi.stubEnv("LOBSTR_ESTIMATED_CREDITS_PER_RESULT", "10");
  vi.stubEnv("LOBSTR_MAX_CONCURRENT_RUNS", "10");
  vi.stubEnv("LOBSTR_BATCH_SIZE", "100");
  vi.stubEnv("LOBSTR_BACKUP_BUDGET_MULTIPLIER", "2");
});
afterEach(() => vi.unstubAllEnvs());
const balance = {
  available: 100_000,
  consumed: 0,
  used_slots: 0,
  total_available_slots: 10,
  has_unpaid_bill: {},
};
const empty = {
  globalSlots: 0,
  pendingSlots: 0,
  orderSlots: 0,
  credits: 0,
  committedOrderCredits: 0,
};
describe("geographic parallel planning", () => {
  it("plans five funded, distinct ZIP shards for 500 phone leads", () => {
    const { runs, config } = createParallelPlan(["GA"], 500, "PHONE_ONLY", 500);
    expect(runs).toHaveLength(5);
    expect(config.concurrency).toBe(5);
    expect(new Set(runs.map((run) => run.zipCode)).size).toBe(5);
    expect(
      runs.every(
        (run) => /^\d{5}$/.test(run.zipCode) && run.targetQuantity === 100,
      ),
    ).toBe(true);
  });
  it("plans fifty children but only ten simultaneous slots for 5000 verified leads", () => {
    const { runs, config } = createParallelPlan(
      ["TX"],
      5_000,
      "VERIFIED_EMAIL",
      10_000,
    );
    expect(runs).toHaveLength(50);
    expect(config.concurrency).toBe(10);
    expect(config.maxProviderCredits).toBe(100_000);
    expect(new Set(runs.map((run) => run.zipCode)).size).toBe(50);
  });
  it.each([2500, 5000, 10000, 20000])(
    "scales funded %i-lead orders up to fifty slots, never above",
    (quantity) => {
      vi.stubEnv("LOBSTR_MAX_CONCURRENT_RUNS", "50");
      const { runs, config } = createParallelPlan(
        ["TX"],
        quantity,
        "PHONE_ONLY",
        quantity,
      );
      expect(config.concurrency).toBe(Math.min(50, quantity / 100));
      expect(config.accountConcurrency).toBe(50);
      expect(runs.reduce((sum, run) => sum + run.targetQuantity, 0)).toBe(
        quantity,
      );
      expect(new Set(runs.map((run) => run.zipCode)).size).toBe(runs.length);
    },
  );
  it("defaults to a fifty-slot ceiling while live provider capacity remains authoritative", () => {
    vi.unstubAllEnvs();
    vi.stubEnv("LOBSTR_ESTIMATED_CREDITS_PER_RESULT", "10");
    const { config } = createParallelPlan(["TX"], 10000, "PHONE_ONLY", 10000);
    expect(config.concurrency).toBe(50);
    expect(availableProviderCapacity(balance, config, empty).slots).toBe(10);
  });
  it("preserves the exact total across multiple states and a partial final batch", () => {
    const { runs } = createParallelPlan(["TX", "CA"], 501, "PHONE_ONLY", 501);
    expect(runs.reduce((sum, run) => sum + run.targetQuantity, 0)).toBe(501);
    expect(
      runs
        .filter((run) => run.state === "TX")
        .reduce((sum, run) => sum + run.targetQuantity, 0),
    ).toBe(251);
  });
  it("preserves leading-zero ZIPs and chooses unused backups", () => {
    const { runs } = createParallelPlan(["MA"], 500, "PHONE_ONLY", 500);
    expect(runs.every((run) => run.zipCode.startsWith("0"))).toBe(true);
    const used = new Set(runs.map((run) => run.zipCode));
    expect(used.has(nextBackupZip("MA", used)!)).toBe(false);
    expect(nextBackupZip("ZZ", used)).toBeUndefined();
  });
  it("requires explicit cost estimation and never confuses wallet and provider credits", () => {
    vi.stubEnv("LOBSTR_ESTIMATED_CREDITS_PER_RESULT", "");
    expect(() => createParallelPlan(["GA"], 500, "PHONE_ONLY", 500)).toThrow();
  });
  it.each(["0", "51", "NaN"])("rejects invalid concurrency %s", (value) => {
    vi.stubEnv("LOBSTR_MAX_CONCURRENT_RUNS", value);
    expect(() => createParallelPlan(["GA"], 500, "PHONE_ONLY", 500)).toThrow();
  });
  it("rejects unfunded plans and unknown or duplicated states", () => {
    expect(() =>
      createParallelPlan(["GA"], 500, "VERIFIED_EMAIL", 500),
    ).toThrow();
    expect(() => createParallelPlan(["ZZ"], 500, "PHONE_ONLY", 500)).toThrow();
    expect(() =>
      createParallelPlan(["GA", "GA"], 500, "PHONE_ONLY", 500),
    ).toThrow();
  });
  it("does not invent more ZIP tasks than the catalog supports", () => {
    expect(() =>
      createParallelPlan(["DC"], 50_000, "PHONE_ONLY", 50_000),
    ).toThrow("distinct ZIP");
  });
  it("keeps paid fan-out behind an explicit rollout flag", () => {
    vi.stubEnv("LOBSTR_PARALLEL_ENABLED", "false");
    expect(parallelFulfillmentEnabled()).toBe(false);
    vi.stubEnv("LOBSTR_PARALLEL_ENABLED", "true");
    expect(parallelFulfillmentEnabled()).toBe(true);
  });
});
describe("account and order capacity bounds", () => {
  const config = () =>
    createParallelPlan(["TX"], 5_000, "PHONE_ONLY", 5_000).config;
  it("honors provider slot availability and local pending claims", () => {
    expect(
      availableProviderCapacity({ ...balance, used_slots: 7 }, config(), {
        ...empty,
        globalSlots: 2,
        pendingSlots: 2,
      }).slots,
    ).toBe(1);
  });
  it("does not double-subtract provider-visible active slots", () => {
    expect(
      availableProviderCapacity({ ...balance, used_slots: 4 }, config(), {
        ...empty,
        globalSlots: 4,
      }).slots,
    ).toBe(6);
  });
  it("caps each funded order independently of the account-wide ceiling", () => {
    const small = createParallelPlan(["GA"], 500, "PHONE_ONLY", 500).config;
    expect(
      availableProviderCapacity(balance, small, {
        ...empty,
        globalSlots: 4,
        orderSlots: 4,
      }).slots,
    ).toBe(1);
  });
  it("subtracts live credit consumption, reservations, and historical order spend", () => {
    expect(
      availableProviderCapacity(
        { ...balance, available: 1000, consumed: 800 },
        config(),
        { ...empty, credits: 200 },
      ).credits,
    ).toBe(0);
    expect(
      availableProviderCapacity(balance, config(), {
        ...empty,
        committedOrderCredits: 100_000,
      }).credits,
    ).toBe(0);
  });
  it("fails closed for unpaid invoices or exhausted slots", () => {
    expect(
      availableProviderCapacity(
        { ...balance, has_unpaid_bill: { status: true } },
        config(),
        empty,
      ),
    ).toEqual({ slots: 0, credits: 0 });
    expect(
      availableProviderCapacity({ ...balance, used_slots: 10 }, config(), empty)
        .slots,
    ).toBe(0);
  });
});
