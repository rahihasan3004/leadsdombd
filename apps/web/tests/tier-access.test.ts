import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMock, dbMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  dbMock: {
    user: { findUnique: vi.fn() },
    agent: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
    leadPurchase: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    unlockedLead: { findMany: vi.fn(), count: vi.fn() },
    leadExport: { create: vi.fn(), update: vi.fn() },
    subscription: { findFirst: vi.fn() },
  },
}));
vi.mock("@fine-leads/auth", () => ({ auth: authMock }));
vi.mock("@fine-leads/database", () => ({ db: dbMock }));

import {
  getAgentLeadAccess,
  leadInventoryWhere,
  redactLeadForTier,
} from "@/lib/lead-access";
import { GET as purchasesGET } from "../app/api/purchases/route";
import { GET as exportGET } from "../app/api/exports/stream/route";
import { GET as agentsGET } from "../app/api/agents/route";
import { GET as agentGET } from "../app/api/agents/[id]/route";

const lead = {
  id: "a1",
  fullName: "Test Agent",
  brokerageName: "Test Realty",
  phone: "2125551234",
  category: "Real Estate",
  brokerageAddress: "1 Main St",
  city: "LA",
  state: "CA",
  zipCode: "90001",
  timezone: "PST",
  websiteUrl: "https://test.example",
  email: "verified@private.example",
  emailStatus: "validated",
  isDeliverable: true,
  googlePlaceId: "place-1",
  dataSource: "TEST",
  rating: 4.5,
  reviewCount: 10,
  scrapedAt: new Date("2026-10-09"),
  googleMapsLink: "https://maps.example/place-1",
  bio: "Contact verified@private.example",
  socialProfiles: { email: "verified@private.example" },
  agentActivities: [{ description: "Mail verified@private.example" }],
};
const request = (path: string) => new NextRequest(`https://app.test${path}`);
const unlock = (
  tier: "PHONE_ONLY" | "VERIFIED_EMAIL",
  id = "u1",
  agent = lead,
) => ({ id, agent, purchase: { tier } });

beforeEach(() => {
  vi.resetAllMocks();
  authMock.mockResolvedValue({ user: { id: "user-1", role: "USER" } });
  dbMock.leadPurchase.findFirst.mockResolvedValue({
    id: "p1",
    tier: "VERIFIED_EMAIL",
    leadCount: 1,
    unlockedLeads: [{ agent: lead }],
  });
  dbMock.leadPurchase.findMany.mockResolvedValue([]);
  dbMock.leadPurchase.count.mockResolvedValue(0);
  dbMock.unlockedLead.findMany.mockResolvedValue([]);
  dbMock.unlockedLead.count.mockResolvedValue(1);
  dbMock.leadExport.create.mockResolvedValue({ id: "export-1" });
  dbMock.leadExport.update.mockResolvedValue({});
  dbMock.agent.findMany.mockResolvedValue([lead]);
  dbMock.agent.findUnique.mockResolvedValue(lead);
  dbMock.agent.count.mockResolvedValue(1);
  dbMock.subscription.findFirst.mockResolvedValue(null);
  dbMock.user.findUnique.mockResolvedValue({ role: "USER", tokenVersion: 0 });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("tier data boundaries", () => {
  it("removes email and duplicate email-bearing free text for phone packs without mutating the source", () => {
    const output = redactLeadForTier(lead, "PHONE_ONLY");
    expect(output).toMatchObject({
      email: null,
      emailStatus: null,
      isDeliverable: false,
      bio: null,
      socialProfiles: null,
      agentActivities: [],
      leadTier: "PHONE_ONLY",
      phone: lead.phone,
    });
    expect(JSON.stringify(output)).not.toContain(lead.email);
    expect(lead.email).toBe("verified@private.example");
  });
  it("retains verified email for full packs", () => {
    expect(redactLeadForTier(lead, "VERIFIED_EMAIL")).toMatchObject({
      email: lead.email,
      leadTier: "VERIFIED_EMAIL",
      isDeliverable: true,
    });
  });
  it.each(["mx_verified", "smtp_error", "undeliverable", "unknown", null])(
    "does not label %s as SMTP verified",
    (emailStatus) => {
      expect(
        redactLeadForTier({ ...lead, emailStatus }, "VERIFIED_EMAIL").email,
      ).toBeNull();
    },
  );
  it("redacts even a validated address when deliverability is false", () => {
    expect(
      redactLeadForTier({ ...lead, isDeliverable: false }, "VERIFIED_EMAIL")
        .email,
    ).toBeNull();
  });
  it("selects phone inventory independently of email verification", () => {
    expect(leadInventoryWhere("PHONE_ONLY")).toEqual({
      AND: [{ phone: { not: null } }, { phone: { not: "" } }],
    });
    expect(leadInventoryWhere("VERIFIED_EMAIL")).toMatchObject({
      isDeliverable: true,
      emailStatus: {
        in: ["validated", "deliverable", "syntax_valid", "mx_valid"],
      },
    });
  });
});

describe("Vault API", () => {
  it("returns a phone-tier order with no email anywhere in the lead JSON", async () => {
    dbMock.leadPurchase.findFirst.mockResolvedValue({
      id: "p1",
      tier: "PHONE_ONLY",
      leadCount: 1,
      unlockedLeads: [{ agent: lead }],
    });
    dbMock.unlockedLead.findMany.mockResolvedValue([{ agent: lead }]);
    const response = await purchasesGET(
      request("/api/purchases?purchaseId=p1&tier=VERIFIED_EMAIL"),
    );
    const body = await response.json();
    expect(body.purchase.tier).toBe("PHONE_ONLY");
    expect(body.leads[0]).toMatchObject({
      email: null,
      phone: lead.phone,
      leadTier: "PHONE_ONLY",
    });
    expect(JSON.stringify(body)).not.toContain(lead.email);
    expect(body.purchase.unlockedLeads).toBeUndefined();
  });
  it("returns the verified email and tier for a full pack", async () => {
    dbMock.unlockedLead.findMany.mockResolvedValue([{ agent: lead }]);
    const body = await (
      await purchasesGET(request("/api/purchases?purchaseId=p1"))
    ).json();
    expect(body.leads[0]).toMatchObject({
      email: lead.email,
      leadTier: "VERIFIED_EMAIL",
    });
  });
  it("keeps tier in the compact summary selection", async () => {
    await purchasesGET(request("/api/purchases?limit=10"));
    expect(dbMock.leadPurchase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ tier: true }),
      }),
    );
  });
  it("checks user ownership and completed status before returning details", async () => {
    dbMock.leadPurchase.findFirst.mockResolvedValue(null);
    expect(
      (
        await purchasesGET(
          request("/api/purchases?purchaseId=foreign-or-refunded"),
        )
      ).status,
    ).toBe(404);
    expect(dbMock.leadPurchase.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "foreign-or-refunded",
          userId: "user-1",
          status: "COMPLETED",
        },
      }),
    );
  });
});

describe("CSV streams", () => {
  it("outputs an empty email cell for a phone pack despite a forged tier query", async () => {
    dbMock.unlockedLead.findMany.mockResolvedValue([unlock("PHONE_ONLY")]);
    const response = await exportGET(
      request("/api/exports/stream?state=CA&purchaseId=p1&tier=VERIFIED_EMAIL"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const csv = await response.text();
    expect(csv).not.toContain(lead.email);
    expect(csv.split("\n")[1].split(",")[9]).toBe('""');
    expect(csv).toContain("212-555-1234");
    expect(dbMock.leadExport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "COMPLETED" }),
      }),
    );
  });
  it("includes deliverable verified email for a full pack", async () => {
    dbMock.unlockedLead.findMany.mockResolvedValue([unlock("VERIFIED_EMAIL")]);
    expect(
      await (
        await exportGET(request("/api/exports/stream?state=CA&purchaseId=p1"))
      ).text(),
    ).toContain(lead.email);
  });
  it("redacts each phone row independently in a mixed-tier state download", async () => {
    dbMock.unlockedLead.count.mockResolvedValue(2);
    const phone = { ...lead, email: "phone-secret@private.example" };
    dbMock.unlockedLead.findMany.mockResolvedValue([
      unlock("PHONE_ONLY", "u1", phone),
      unlock("VERIFIED_EMAIL", "u2"),
    ]);
    const csv = await (
      await exportGET(request("/api/exports/stream?state=CA"))
    ).text();
    expect(csv).not.toContain(phone.email);
    expect(csv).toContain(lead.email);
    expect(csv.trim().split("\n")).toHaveLength(3);
    expect(dbMock.unlockedLead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          purchase: { status: "COMPLETED" },
          agent: { state: "CA" },
        },
      }),
    );
  });
  it("exports phone leads that have no email or deliverability flag", async () => {
    dbMock.unlockedLead.findMany.mockResolvedValue([
      unlock("PHONE_ONLY", "u1", { ...lead, email: "", isDeliverable: false }),
    ]);
    const response = await exportGET(request("/api/exports/stream?state=CA"));
    expect(response.status).toBe(200);
    expect((await response.text()).trim().split("\n")).toHaveLength(2);
    expect(dbMock.unlockedLead.count.mock.calls[0][0].where.agent).toEqual({
      state: "CA",
    });
  });
  it("does not expose a full pack address whose SMTP status is no longer valid", async () => {
    dbMock.unlockedLead.findMany.mockResolvedValue([
      unlock("VERIFIED_EMAIL", "u1", { ...lead, emailStatus: "undeliverable" }),
    ]);
    expect(
      await (await exportGET(request("/api/exports/stream?state=CA"))).text(),
    ).not.toContain(lead.email);
  });
  it("uses bounded cursor batches, not a full lead-id payload", async () => {
    const batch = Array.from({ length: 1000 }, (_, i) =>
      unlock("PHONE_ONLY", `u${i}`),
    );
    dbMock.unlockedLead.count.mockResolvedValue(1001);
    dbMock.unlockedLead.findMany
      .mockResolvedValueOnce(batch)
      .mockResolvedValueOnce([unlock("VERIFIED_EMAIL", "u1000")]);
    const csv = await (
      await exportGET(request("/api/exports/stream?state=CA&purchaseId=p1"))
    ).text();
    expect(csv.trim().split("\n")).toHaveLength(1002);
    expect(dbMock.unlockedLead.findMany).toHaveBeenCalledTimes(2);
    expect(dbMock.unlockedLead.findMany.mock.calls[1][0]).toMatchObject({
      take: 1,
      cursor: { id: "u999" },
      skip: 1,
      where: {
        userId: "user-1",
        purchaseId: "p1",
        purchase: { status: "COMPLETED" },
      },
    });
    expect(dbMock.agent.findMany).not.toHaveBeenCalled();
  });
  it("denies inaccessible or refunded purchase IDs before streaming", async () => {
    dbMock.leadPurchase.findFirst.mockResolvedValue(null);
    expect(
      (
        await exportGET(
          request("/api/exports/stream?state=CA&purchaseId=foreign"),
        )
      ).status,
    ).toBe(403);
    expect(dbMock.leadPurchase.findFirst).toHaveBeenCalledWith({
      where: { id: "foreign", userId: "user-1", status: "COMPLETED" },
      select: { id: true, tier: true },
    });
    expect(dbMock.unlockedLead.count).not.toHaveBeenCalled();
    expect(dbMock.leadExport.create).not.toHaveBeenCalled();
  });
  it("returns 404 when no completed unlocks exist", async () => {
    dbMock.unlockedLead.count.mockResolvedValue(0);
    expect(
      (await exportGET(request("/api/exports/stream?state=CA"))).status,
    ).toBe(404);
    expect(dbMock.leadExport.create).not.toHaveBeenCalled();
  });
  it("requires authentication before any database reads", async () => {
    authMock.mockResolvedValue(null);
    expect(
      (await exportGET(request("/api/exports/stream?state=CA"))).status,
    ).toBe(401);
    expect(dbMock.unlockedLead.count).not.toHaveBeenCalled();
  });
  it("marks a failed stream as FAILED", async () => {
    dbMock.unlockedLead.findMany.mockRejectedValue(
      new Error("database stream failed"),
    );
    const response = await exportGET(request("/api/exports/stream?state=CA"));
    expect(response.status).toBe(503);
    expect(response.headers.get("Content-Disposition")).toBeNull();
    expect((await response.json()).error).toContain("could not be prepared");
    expect(dbMock.leadExport.update).toHaveBeenCalledWith({
      where: { id: "export-1" },
      data: { status: "FAILED" },
    });
  });
});

describe("alternative agent access routes", () => {
  it("batch-scopes entitlements to this user, these agents and completed orders", async () => {
    dbMock.unlockedLead.findMany.mockResolvedValue([
      { agentId: "a1", purchase: { tier: "PHONE_ONLY" } },
    ]);
    expect((await getAgentLeadAccess("user-1", [lead])).get("a1")).toBe(
      "PHONE_ONLY",
    );
    expect(dbMock.unlockedLead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          agentId: { in: ["a1"] },
          purchase: { userId: "user-1", status: "COMPLETED" },
        },
      }),
    );
    expect(dbMock.leadPurchase.findMany).not.toHaveBeenCalled();
  });
  it("avoids queries for an empty page", async () => {
    expect((await getAgentLeadAccess("user-1", [])).size).toBe(0);
    expect(dbMock.unlockedLead.findMany).not.toHaveBeenCalled();
  });
  it("never grants state-wide access to zero-allocation legacy quantity orders", async () => {
    dbMock.leadPurchase.findMany.mockResolvedValue([
      { tier: "VERIFIED_EMAIL", unlockedStates: ["CA"] },
    ]);
    const access = await getAgentLeadAccess("user-1", [
      lead,
      { id: "tx1", state: "TX" },
    ]);
    expect(access.has("a1")).toBe(false);
    expect(access.has("tx1")).toBe(false);
  });
  it("redacts full email in the agent list for a phone-tier unlock", async () => {
    dbMock.unlockedLead.findMany.mockResolvedValue([
      { agentId: "a1", purchase: { tier: "PHONE_ONLY" } },
    ]);
    const body = await (
      await agentsGET(request("/api/agents?state=CA"))
    ).json();
    expect(body.agents[0]).toMatchObject({
      email: null,
      phone: lead.phone,
      isLocked: false,
      leadTier: "PHONE_ONLY",
    });
    expect(JSON.stringify(body)).not.toContain(lead.email);
  });
  it("redacts full email and activities in the agent detail route for phone-tier unlocks", async () => {
    dbMock.unlockedLead.findMany.mockResolvedValue([
      { agentId: "a1", purchase: { tier: "PHONE_ONLY" } },
    ]);
    const body = await (
      await agentGET(request("/api/agents/a1"), {
        params: Promise.resolve({ id: "a1" }),
      })
    ).json();
    expect(body).toMatchObject({
      email: null,
      phone: lead.phone,
      leadTier: "PHONE_ONLY",
      agentActivities: [],
    });
    expect(JSON.stringify(body)).not.toContain(lead.email);
  });
  it("does not grant all agents in a state access through quantity orders", async () => {
    const body = await (
      await agentGET(request("/api/agents/a1"), {
        params: Promise.resolve({ id: "a1" }),
      })
    ).json();
    expect(body.isUnlocked).toBe(false);
    expect(body.email).not.toBe(lead.email);
    expect(dbMock.leadPurchase.findMany).not.toHaveBeenCalled();
  });
  it("includes verified email for an individually unlocked full-pack lead", async () => {
    dbMock.unlockedLead.findMany.mockResolvedValue([
      { agentId: "a1", purchase: { tier: "VERIFIED_EMAIL" } },
    ]);
    const body = await (
      await agentGET(request("/api/agents/a1"), {
        params: Promise.resolve({ id: "a1" }),
      })
    ).json();
    expect(body.email).toBe(lead.email);
  });
});

describe("P0 explicit entitlement regression", () => {
  const detail = () =>
    agentGET(request("/api/agents/a1"), {
      params: Promise.resolve({ id: "a1" }),
    });
  it.each(["FREE", "PRO", "ENTERPRISE"])(
    "%s ACTIVE subscription never grants lead access",
    async (tier) => {
      dbMock.subscription.findFirst.mockResolvedValue({
        id: "sub",
        tier,
        status: "ACTIVE",
      });
      const body = await (await detail()).json();
      expect(body.isUnlocked).toBe(false);
      expect(body.email).not.toBe(lead.email);
      expect(body.socialProfiles).toBeUndefined();
      expect(dbMock.subscription.findFirst).not.toHaveBeenCalled();
    },
  );
  it("ACTIVE subscription cannot upgrade a phone-only unlock", async () => {
    dbMock.subscription.findFirst.mockResolvedValue({
      id: "free-sub",
      tier: "FREE",
      status: "ACTIVE",
    });
    dbMock.unlockedLead.findMany.mockResolvedValue([
      { agentId: "a1", purchase: { tier: "PHONE_ONLY" } },
    ]);
    expect(await (await detail()).json()).toMatchObject({
      email: null,
      socialProfiles: null,
      leadTier: "PHONE_ONLY",
    });
  });
  it("explicit verified unlock includes verified email", async () => {
    dbMock.unlockedLead.findMany.mockResolvedValue([
      { agentId: "a1", purchase: { tier: "VERIFIED_EMAIL" } },
    ]);
    expect(await (await detail()).json()).toMatchObject({
      email: lead.email,
      leadTier: "VERIFIED_EMAIL",
    });
  });
  it.each(["USER", null])(
    "stale admin JWT cannot bypass fresh role %s",
    async (role) => {
      authMock.mockResolvedValue({
        user: { id: "user-1", role: "ADMIN", tokenVersion: 0 },
      });
      dbMock.user.findUnique.mockResolvedValue(
        role ? { role, tokenVersion: 0 } : null,
      );
      expect((await (await detail()).json()).isUnlocked).toBe(false);
    },
  );
  it("revoked admin token is denied even if DB role is still admin", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", role: "ADMIN", tokenVersion: 0 },
    });
    dbMock.user.findUnique.mockResolvedValue({
      role: "ADMIN",
      tokenVersion: 1,
    });
    expect((await (await detail()).json()).isUnlocked).toBe(false);
  });
  it("fresh authorized admin retains admin access", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", role: "ADMIN", tokenVersion: 2 },
    });
    dbMock.user.findUnique.mockResolvedValue({
      role: "ADMIN",
      tokenVersion: 2,
    });
    expect((await (await detail()).json()).email).toBe(lead.email);
  });
});

describe("bounded Vault lead pagination", () => {
  it("loads only visible lead rows, with an independent count", async () => {
    dbMock.unlockedLead.count.mockResolvedValue(50000);
    dbMock.unlockedLead.findMany.mockResolvedValue([{ agent: lead }]);
    const response = await purchasesGET(
      request("/api/purchases?purchaseId=p1&page=3&limit=10&q=Realty"),
    );
    const body = await response.json();
    expect(body.pagination).toMatchObject({
      total: 50000,
      pages: 5000,
      currentPage: 3,
      limit: 10,
    });
    expect(dbMock.unlockedLead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        skip: 20,
        where: expect.objectContaining({
          purchaseId: "p1",
          userId: "user-1",
          agent: expect.any(Object),
        }),
      }),
    );
    expect(
      dbMock.leadPurchase.findFirst.mock.calls[0][0].include,
    ).toBeUndefined();
  });
  it("rejects malformed page input before detail reads", async () => {
    expect(
      (await purchasesGET(request("/api/purchases?purchaseId=p1&page=-1")))
        .status,
    ).toBe(400);
    expect(dbMock.unlockedLead.findMany).not.toHaveBeenCalled();
  });
  it("does not search email fields for PHONE_ONLY orders", async () => {
    dbMock.leadPurchase.findFirst.mockResolvedValue({
      id: "p1",
      tier: "PHONE_ONLY",
      leadCount: 1,
    });
    await purchasesGET(request("/api/purchases?purchaseId=p1&q=secret"));
    expect(
      JSON.stringify(dbMock.unlockedLead.count.mock.calls[0][0]),
    ).not.toContain('"email"');
  });
});
