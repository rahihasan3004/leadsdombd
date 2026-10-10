import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  agent: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
}));
vi.mock("@fine-leads/database", () => ({ db }));
import { importAgents, updateAdminAgent } from "@/lib/admin/agents-service";
beforeEach(() => {
  vi.resetAllMocks();
  db.agent.findUnique.mockResolvedValue({ id: "a1", email: "old@test.dev" });
  db.agent.findFirst.mockResolvedValue({ id: "a1", email: "old@test.dev" });
});
describe("SMTP evidence invalidation", () => {
  it("clears all verification evidence on manual email edit", async () => {
    await updateAdminAgent("a1", {
      email: "new@test.dev",
      isDeliverable: true,
    });
    expect(db.agent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isDeliverable: false,
          isVerified: false,
          emailStatus: null,
          lastVerifiedAt: null,
          verificationScore: 0,
        }),
      }),
    );
  });
  it("preserves evidence when only capitalization or business fields change", async () => {
    await updateAdminAgent("a1", {
      email: "OLD@test.dev",
      fullName: "New Name",
    });
    expect(
      db.agent.update.mock.calls[0][0].data.lastVerifiedAt,
    ).toBeUndefined();
  });
  it("invalidates a changed imported email on a matching Place ID", async () => {
    await importAgents([
      { fullName: "Agent", email: "new@test.dev", googlePlaceId: "place" },
    ]);
    expect(db.agent.update.mock.calls[0][0].data).toMatchObject({
      isDeliverable: false,
      emailStatus: null,
      lastVerifiedAt: null,
    });
  });
  it("does not label a newly imported email SMTP deliverable", async () => {
    db.agent.findFirst.mockResolvedValue(null);
    await importAgents([{ fullName: "Agent", email: "new@test.dev" }]);
    expect(db.agent.create.mock.calls[0][0].data.isDeliverable).toBe(false);
  });
  it("reports malformed rows rather than crashing after previous writes", async () => {
    const result = await importAgents([null, { fullName: 42 }] as never);
    expect(result.failedCount).toBe(2);
    expect(db.agent.update).not.toHaveBeenCalled();
  });
});
