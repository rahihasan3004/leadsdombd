import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import ts from "typescript";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  purchase: vi.fn(),
  count: vi.fn(),
  rows: vi.fn(),
}));
vi.mock("@fine-leads/auth", () => ({ auth: m.auth }));
vi.mock("@fine-leads/database", () => ({
  db: {
    leadPurchase: { findFirst: m.purchase },
    unlockedLead: { count: m.count, findMany: m.rows },
  },
}));
import { GET } from "../app/api/purchases/route";
const lead = {
  id: "a1",
  fullName: "Burns & Ellis REALTORS",
  phone: "+13026744220",
  rating: 5,
  reviewCount: 290,
  state: "DE",
  zipCode: "19901",
  googleMapsLink: "https://maps.example",
  brokerageAddress: "490 N Dupont Hwy",
  timezone: null,
  dataSource: "APIFY",
  email: "agent@example.com",
  emailStatus: "syntax_valid",
  isDeliverable: true,
  socialProfiles: {
    linkedin: "https://linkedin.com/in/agent",
    _apify: { actor: "internal-only" },
  },
};
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ user: { id: "u1" } });
  m.purchase.mockResolvedValue({
    id: "p1",
    tier: "PHONE_ONLY",
    status: "COMPLETED",
    leadCount: 10,
    unlockedStates: ["DE"],
  });
  m.count.mockResolvedValue(10);
  m.rows.mockResolvedValue([{ agent: lead }]);
});
describe("paginated cached Vault details", () => {
  it("selects full visible-page details including rating/reviews, with server-side phone redaction", async () => {
    const response = await GET(
      new Request(
        "https://app.test/api/purchases?purchaseId=p1&page=2&limit=10",
      ),
    );
    const body = await response.json();
    expect(body.leads[0]).toMatchObject({
      rating: 5,
      reviewCount: 290,
      brokerageAddress: lead.brokerageAddress,
      googleMapsLink: lead.googleMapsLink,
      dataSource: "LEADSDOM",
      email: null,
      socialProfiles: null,
      leadTier: "PHONE_ONLY",
    });
    expect(JSON.stringify(body)).not.toMatch(
      /APIFY|LOBSTR|internal-only|agent@example/,
    );
    expect(m.rows).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        skip: 10,
        where: expect.objectContaining({ userId: "u1", purchaseId: "p1" }),
        select: {
          agent: {
            select: expect.objectContaining({
              rating: true,
              reviewCount: true,
              brokerageAddress: true,
              socialProfiles: true,
              googleMapsLink: true,
            }),
          },
        },
      }),
    );
  });
  it("keeps staged email eligibility intact before branding and strips provider metadata", async () => {
    m.purchase.mockResolvedValue({
      id: "p1",
      tier: "VERIFIED_EMAIL",
      status: "COMPLETED",
      leadCount: 10,
      unlockedStates: ["DE"],
    });
    const body = await (
      await GET(new Request("https://app.test/api/purchases?purchaseId=p1"))
    ).json();
    expect(body.leads[0]).toMatchObject({
      dataSource: "LEADSDOM",
      email: lead.email,
      socialProfiles: { linkedin: lead.socialProfiles.linkedin },
    });
    expect(JSON.stringify(body)).not.toMatch(/APIFY|LOBSTR|internal-only/);
  });
  it("does not read leads for an unauthorized purchase", async () => {
    m.purchase.mockResolvedValue(null);
    expect(
      (
        await GET(
          new Request("https://app.test/api/purchases?purchaseId=other"),
        )
      ).status,
    ).toBe(404);
    expect(m.rows).not.toHaveBeenCalled();
  });
  it("opens mouse/keyboard rows from cached state without a fetch or loading placeholder", () => {
    const source = fs.readFileSync(
      new URL("../app/dashboard/lists/page.tsx", import.meta.url),
      "utf8",
    );
    const ast = ts.createSourceFile(
      "page.tsx",
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    let handler: ts.VariableDeclaration | undefined;
    const visit = (node: ts.Node) => {
      if (
        ts.isVariableDeclaration(node) &&
        node.name.getText(ast) === "handleOpenAgent"
      )
        handler = node;
      ts.forEachChild(node, visit);
    };
    visit(ast);
    expect(handler).toBeDefined();
    const text = handler!.getText(ast);
    expect(text).toContain("setSelectedAgent(agent)");
    expect(text).toContain("setModalOpen(true)");
    expect(text).not.toMatch(/fetch|await|Loading/);
    expect(source).not.toContain("Loading lead details...");
    // No redundant tier pill in the order header or individual rows.
    expect(source).not.toContain("ColdCallingTierBadge");
  });
});
