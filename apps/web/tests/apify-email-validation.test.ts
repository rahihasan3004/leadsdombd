import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ mx: vi.fn(), update: vi.fn() }));
vi.mock("node:dns/promises", () => ({ resolveMx: mocks.mx }));
vi.mock("@fine-leads/database", async (original) => ({
  ...(await original<typeof import("@fine-leads/database")>()),
  db: { agent: { updateMany: mocks.update } },
}));
import {
  validateApifyEmail,
  validateExistingApifyEmail,
} from "@/lib/scraper/apify-email-validator";
import {
  validExtractedEmail,
  apifyCandidateLimit,
} from "@/lib/scraper/apify-email-policy";
import { leadInventoryWhere, redactLeadForTier } from "@/lib/lead-access";
import { freshInventoryWhere } from "@/lib/scraper/fulfillment-policy";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APIFY_EMAIL_VALIDATION_MODE", "syntax");
  mocks.update.mockResolvedValue({ count: 1 });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("serverless staged Apify email validation", () => {
  it("accepts a source email without DNS or local SMTP and does not claim mailbox verification", async () => {
    expect(await validateApifyEmail("agent@example.com")).toEqual({
      status: "syntax_valid",
      eligible: true,
      verified: false,
    });
    expect(mocks.mx).not.toHaveBeenCalled();
  });
  it.each([
    "bad",
    "a@localhost",
    "a@-example.com",
    "a@example-.com",
    "a@example.c",
    "a@example..com",
    "a@127.0.0.1",
    "a@x.invalid_",
    "a".repeat(65) + "@example.com",
  ])("rejects malformed syntax/domain %s", async (email) => {
    expect(validExtractedEmail(email)).toBe(false);
    expect((await validateApifyEmail(email)).eligible).toBe(false);
  });
  it("supports MX staging without upgrading it to SMTP verification", async () => {
    vi.stubEnv("APIFY_EMAIL_VALIDATION_MODE", "mx");
    mocks.mx.mockResolvedValue([
      { priority: 10, exchange: "mail.example.com" },
    ]);
    expect(await validateApifyEmail("a@example.com")).toEqual({
      status: "mx_valid",
      eligible: true,
      verified: false,
    });
  });
  it.each([{ records: [] }, { records: [{ priority: 0, exchange: "." }] }])(
    "rejects missing/null MX",
    async ({ records }) => {
      vi.stubEnv("APIFY_EMAIL_VALIDATION_MODE", "mx");
      mocks.mx.mockResolvedValue(records);
      expect((await validateApifyEmail("a@example.com")).status).toBe("no_mx");
    },
  );
  it("treats ENODATA as permanent but DNS service failures as retryable", async () => {
    vi.stubEnv("APIFY_EMAIL_VALIDATION_MODE", "mx");
    mocks.mx
      .mockRejectedValueOnce(Object.assign(new Error(), { code: "ENODATA" }))
      .mockRejectedValueOnce(
        Object.assign(new Error("DNS unavailable"), { code: "ESERVFAIL" }),
      );
    expect((await validateApifyEmail("a@example.com")).eligible).toBe(false);
    await expect(validateApifyEmail("a@example.com")).rejects.toThrow(
      "DNS unavailable",
    );
  });
  it("fails closed on a misspelled validation mode", async () => {
    vi.stubEnv("APIFY_EMAIL_VALIDATION_MODE", "typo");
    await expect(validateApifyEmail("a@example.com")).rejects.toThrow();
  });
  it("allows staged tier access only for APIFY and never for phone-only", () => {
    const lead = {
      email: "a@example.com",
      emailStatus: "syntax_valid",
      isDeliverable: true,
      dataSource: "APIFY",
      socialProfiles: { linkedin: "https://linkedin.com/in/a" },
    };
    expect(redactLeadForTier(lead, "VERIFIED_EMAIL").email).toBe(lead.email);
    expect(
      redactLeadForTier({ ...lead, dataSource: "LOBSTR" }, "VERIFIED_EMAIL")
        .email,
    ).toBeNull();
    expect(
      redactLeadForTier({ ...lead, isDeliverable: false }, "VERIFIED_EMAIL")
        .email,
    ).toBeNull();
    expect(redactLeadForTier(lead, "PHONE_ONLY")).toMatchObject({
      email: null,
      emailStatus: null,
      socialProfiles: null,
      isDeliverable: false,
    });
  });
  it("keeps the APIFY source gate nested alongside freshness and ownership", () => {
    expect(leadInventoryWhere("VERIFIED_EMAIL").AND).toContainEqual({
      OR: [
        { emailStatus: { in: ["validated", "deliverable"] } },
        {
          dataSource: "APIFY",
          emailStatus: { in: ["syntax_valid", "mx_valid"] },
        },
      ],
    });
    const where = freshInventoryWhere("user", ["TX"], "VERIFIED_EMAIL");
    expect(where.AND).toEqual(leadInventoryWhere("VERIFIED_EMAIL").AND);
    expect(where.OR).toHaveLength(3);
    expect(where.unlockedBy).toEqual({ none: { userId: "user" } });
  });
  it("a mode upgrade excludes weaker staged emails without weakening verified emails", () => {
    vi.stubEnv("APIFY_EMAIL_VALIDATION_MODE", "mx");
    const lead = {
      email: "a@example.com",
      emailStatus: "syntax_valid",
      isDeliverable: true,
      dataSource: "APIFY",
    };
    expect(redactLeadForTier(lead, "VERIFIED_EMAIL").email).toBeNull();
    expect(
      redactLeadForTier({ ...lead, emailStatus: "mx_valid" }, "VERIFIED_EMAIL")
        .email,
    ).toBe(lead.email);
    vi.stubEnv("APIFY_EMAIL_VALIDATION_MODE", "api");
    expect(
      redactLeadForTier({ ...lead, emailStatus: "mx_valid" }, "VERIFIED_EMAIL")
        .email,
    ).toBeNull();
    expect(
      redactLeadForTier(
        { ...lead, emailStatus: "deliverable" },
        "VERIFIED_EMAIL",
      ).email,
    ).toBe(lead.email);
  });
  it("uses a compare-and-set for old APIFY rows without overwriting stronger or negative evidence", async () => {
    await validateExistingApifyEmail("agent", "a@example.com");
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "agent",
          email: "a@example.com",
          dataSource: "APIFY",
          OR: [
            { emailStatus: null },
            {
              emailStatus: {
                in: ["unverified", "unknown", "syntax_valid", "mx_valid"],
              },
            },
          ],
        },
        data: expect.objectContaining({
          emailStatus: "syntax_valid",
          isVerified: false,
          isDeliverable: true,
        }),
      }),
    );
  });
  it.each([
    [1, 20],
    [5, 20],
    [11, 22],
    [10000, 20000],
  ])("buffers %s requested emails to %s candidates", (n, expected) => {
    expect(apifyCandidateLimit(n, "VERIFIED_EMAIL")).toBe(expected);
    expect(apifyCandidateLimit(n, "PHONE_ONLY")).toBe(n);
  });
  it("supports a trusted API validator with bounded authenticated requests and matching SMTP evidence", async () => {
    vi.stubEnv("APIFY_EMAIL_VALIDATION_MODE", "api");
    vi.stubEnv(
      "APIFY_EMAIL_VALIDATOR_URL",
      "https://validator.example.com/check",
    );
    vi.stubEnv("APIFY_EMAIL_VALIDATOR_TOKEN", "test-only-token");
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            email: "a@example.com",
            status: "deliverable",
            isDeliverable: true,
            isCatchAll: false,
            isDisposable: false,
            smtpCode: 250,
          }),
        ),
      );
    vi.stubGlobal("fetch", fetcher);
    expect(await validateApifyEmail("a@example.com")).toEqual({
      status: "deliverable",
      eligible: true,
      verified: true,
    });
    expect(fetcher.mock.calls[0]![1]).toMatchObject({
      redirect: "error",
      cache: "no-store",
      headers: { Authorization: "Bearer test-only-token" },
      body: JSON.stringify({ email: "a@example.com" }),
    });
  });
  it.each(["unknown", "mx_valid"])(
    "does not silently accept an inconclusive API status %s",
    async (status) => {
      vi.stubEnv("APIFY_EMAIL_VALIDATION_MODE", "api");
      vi.stubEnv(
        "APIFY_EMAIL_VALIDATOR_URL",
        "https://validator.example.com/check",
      );
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            new Response(
              JSON.stringify({
                email: "a@example.com",
                status,
                isDeliverable: true,
                isCatchAll: false,
                isDisposable: false,
                smtpCode: null,
              }),
            ),
          ),
      );
      await expect(validateApifyEmail("a@example.com")).rejects.toThrow(
        "inconclusive",
      );
    },
  );
  it("rejects a validator response for a different email", async () => {
    vi.stubEnv("APIFY_EMAIL_VALIDATION_MODE", "api");
    vi.stubEnv(
      "APIFY_EMAIL_VALIDATOR_URL",
      "https://validator.example.com/check",
    );
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              email: "other@example.com",
              status: "deliverable",
              isDeliverable: true,
              isCatchAll: false,
              isDisposable: false,
              smtpCode: 250,
            }),
          ),
        ),
    );
    await expect(validateApifyEmail("a@example.com")).rejects.toThrow(
      "mismatch",
    );
  });
  it("rejects insecure API endpoints before calling fetch", async () => {
    vi.stubEnv("APIFY_EMAIL_VALIDATION_MODE", "api");
    vi.stubEnv(
      "APIFY_EMAIL_VALIDATOR_URL",
      "http://validator.example.com/check",
    );
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(validateApifyEmail("a@example.com")).rejects.toThrow("HTTPS");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
