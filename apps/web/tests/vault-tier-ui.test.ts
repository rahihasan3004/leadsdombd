import { beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AgentDetailModal, type AgentData } from "@/components/dashboard/agent-detail-modal";

vi.mock("@/hooks/use-modal-a11y", () => ({ useModalA11y: () => undefined }));
vi.mock("react-dom", async (importOriginal) => ({
  ...await importOriginal<typeof import("react-dom")>(),
  createPortal: (children: React.ReactNode) => children,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

beforeEach(() => {
  // The repo's Vitest configuration uses classic JSX; Next uses automatic JSX.
  vi.stubGlobal("React", React);
  vi.stubGlobal("document", { body: {} });
});
const agent = { id: "a1", fullName: "Test", phone: "2125551234", email: "secret@private.example" } as AgentData;

describe("Vault lead detail tier badge", () => {
  it("hides a stale email and its copy control for phone-only leads", () => {
    const html = renderToStaticMarkup(React.createElement(AgentDetailModal, { agent: { ...agent, leadTier: "PHONE_ONLY" }, open: true, onClose: () => undefined }));
    expect(html).toContain("Cold Calling Tier (No Email Included)");
    expect(html).not.toContain(agent.email);
    expect(html).not.toContain("100% Deliverable Email");
  });
  it("shows verified email for a full pack", () => {
    const html = renderToStaticMarkup(React.createElement(AgentDetailModal, { agent: { ...agent, leadTier: "VERIFIED_EMAIL" }, open: true, onClose: () => undefined }));
    expect(html).toContain(agent.email);
    expect(html).toContain("100% Deliverable Email");
    expect(html).not.toContain("Cold Calling Tier (No Email Included)");
  });
});
