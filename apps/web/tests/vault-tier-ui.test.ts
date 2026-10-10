import { beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AgentDetailModal,
  type AgentData,
} from "@/components/dashboard/agent-detail-modal";

vi.mock("@/hooks/use-modal-a11y", () => ({ useModalA11y: () => undefined }));
vi.mock("react-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-dom")>()),
  createPortal: (children: React.ReactNode) => children,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

beforeEach(() => {
  // The repo's Vitest configuration uses classic JSX; Next uses automatic JSX.
  vi.stubGlobal("React", React);
  vi.stubGlobal("document", { body: {} });
});
const agent = {
  id: "a1",
  fullName: "Test",
  phone: "2125551234",
  email: "secret@private.example",
} as AgentData;

describe("Vault lead detail tier badge", () => {
  it("hides a stale email and its copy control for phone-only leads", () => {
    const html = renderToStaticMarkup(
      React.createElement(AgentDetailModal, {
        agent: { ...agent, leadTier: "PHONE_ONLY" },
        open: true,
        onClose: () => undefined,
      }),
    );
    expect(html).toContain("Cold Calling Tier (No Email Included)");
    expect(html).not.toContain(agent.email);
    expect(html).not.toContain("100% Deliverable Email");
  });
  it("shows verified email for a full pack", () => {
    const html = renderToStaticMarkup(
      React.createElement(AgentDetailModal, {
        agent: { ...agent, leadTier: "VERIFIED_EMAIL" },
        open: true,
        onClose: () => undefined,
      }),
    );
    expect(html).toContain(agent.email);
    expect(html).toContain("100% Deliverable Email");
    expect(html).not.toContain("Cold Calling Tier (No Email Included)");
  });
});

const bonus = {
  linkedin: "https://www.linkedin.com/in/agent",
  facebook: "https://www.facebook.com/agent",
  instagram: "https://www.instagram.com/agent",
  whatsapp: "https://wa.me/12125551234",
  twitter: "https://x.com/agent",
  tiktok: "https://www.tiktok.com/@agent",
  youtube: "https://www.youtube.com/@agent",
};
describe("Vault social profile entitlements", () => {
  it("hides stale bonus links and a social Website alias for phone packs", () => {
    const html = renderToStaticMarkup(
      React.createElement(AgentDetailModal, {
        agent: {
          ...agent,
          leadTier: "PHONE_ONLY",
          socialProfiles: bonus,
          websiteUrl: bonus.facebook,
        },
        open: true,
        onClose: () => undefined,
      }),
    );
    expect(html).not.toContain("Bonus Enriched Profiles");
    for (const url of Object.values(bonus)) expect(html).not.toContain(url);
  });
  it("shows every available safe profile for a full outreach pack", () => {
    const html = renderToStaticMarkup(
      React.createElement(AgentDetailModal, {
        agent: { ...agent, leadTier: "VERIFIED_EMAIL", socialProfiles: bonus },
        open: true,
        onClose: () => undefined,
      }),
    );
    expect(html).toContain("Bonus Enriched Profiles (if available)");
    for (const url of Object.values(bonus)) expect(html).toContain(url);
  });
  it("does not treat missing tier, scraper metadata or unsafe links as bonus access", () => {
    const missing = renderToStaticMarkup(
      React.createElement(AgentDetailModal, {
        agent: { ...agent, socialProfiles: bonus },
        open: true,
        onClose: () => undefined,
      }),
    );
    expect(missing).not.toContain(bonus.linkedin);
    const html = renderToStaticMarkup(
      React.createElement(AgentDetailModal, {
        agent: {
          ...agent,
          leadTier: "VERIFIED_EMAIL",
          socialProfiles: {
            linkedin: "javascript:alert(1)",
            _lobstr: { nameForEmails: "internal-only" },
          },
        },
        open: true,
        onClose: () => undefined,
      }),
    );
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("internal-only");
    expect(html).not.toContain("Bonus Enriched Profiles");
  });
});

it.each([
  ["syntax_valid", "Syntax checked"],
  ["mx_valid", "MX checked"],
])(
  "labels APIFY %s honestly without SMTP deliverability claims",
  (emailStatus, label) => {
    const html = renderToStaticMarkup(
      React.createElement(AgentDetailModal, {
        agent: {
          ...agent,
          leadTier: "VERIFIED_EMAIL",
          dataSource: "APIFY",
          emailStatus,
          isVerified: false,
        },
        open: true,
        onClose: () => undefined,
      }),
    );
    expect(html).toContain(label);
    expect(html).toContain(agent.email);
    expect(html).not.toContain("100% Deliverable");
  },
);
