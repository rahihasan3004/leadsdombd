import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { db, guard } = vi.hoisted(() => ({
  guard: vi.fn(),
  db: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    user: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
    session: { deleteMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));
vi.mock("@fine-leads/database", async (original) => ({
  ...(await original<typeof import("@fine-leads/database")>()),
  db,
}));
vi.mock("@/lib/admin-guard", () => ({ requireAdminApi: guard }));
import { PATCH } from "../app/api/admin/users/[id]/route";
import { updateUser } from "@/lib/admin/users-service";
const request = (role: unknown) =>
  new NextRequest("https://app.test/api/admin/users/target", {
    method: "PATCH",
    body: JSON.stringify({ role }),
    headers: { "Content-Type": "application/json" },
  });
const context = (id = "target") => ({ params: Promise.resolve({ id }) });
beforeEach(() => {
  vi.resetAllMocks();
  guard.mockResolvedValue({
    user: { id: "actor", role: "SUPER_ADMIN" },
    session: { user: { tokenVersion: 7 } },
  });
  db.$transaction.mockImplementation(async (cb) => cb(db));
  db.$queryRaw.mockResolvedValue([]);
  db.user.findUnique.mockImplementation(async ({ where }) =>
    where.id === "actor"
      ? { role: "SUPER_ADMIN", tokenVersion: 7 }
      : { role: "USER" },
  );
  db.user.update.mockResolvedValue({ id: "target", role: "ADMIN" });
  db.user.count.mockResolvedValue(2);
});
describe("P0 admin role authorization", () => {
  it.each(["actor", "target"])(
    "ordinary ADMIN cannot promote %s",
    async (id) => {
      guard.mockResolvedValue({
        user: { id: "actor", role: "ADMIN" },
        session: { user: { tokenVersion: 7 } },
      });
      expect((await PATCH(request("SUPER_ADMIN"), context(id))).status).toBe(
        403,
      );
      expect(db.user.update).not.toHaveBeenCalled();
    },
  );
  it.each(["USER", "ADMIN", "SUPER_ADMIN"])(
    "SUPER_ADMIN cannot set own role to %s",
    async (role) => {
      expect((await PATCH(request(role), context("actor"))).status).toBe(403);
      expect(db.user.update).not.toHaveBeenCalled();
    },
  );
  it("invalid role is a 400 without writes", async () => {
    expect((await PATCH(request("OWNER"), context())).status).toBe(400);
  });
  it.each([
    { role: "ADMIN", tokenVersion: 7 },
    { role: "SUPER_ADMIN", tokenVersion: 8 },
    null,
  ])("service rechecks fresh actor under lock: %j", async (actor) => {
    db.user.findUnique.mockResolvedValueOnce(actor);
    await expect(
      updateUser("target", { role: "SUPER_ADMIN" }, "actor", 7),
    ).rejects.toMatchObject({ status: 403 });
    expect(db.user.update).not.toHaveBeenCalled();
  });
  it("permitted role change invalidates JWT and DB sessions with atomic audit", async () => {
    expect((await PATCH(request("ADMIN"), context())).status).toBe(200);
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: "ADMIN",
          tokenVersion: { increment: 1 },
        }),
      }),
    );
    expect(db.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: "target" },
    });
    expect(db.auditLog.create).toHaveBeenCalled();
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      db.user.findUnique.mock.invocationCallOrder[0],
    );
  });
  it("last-super-admin safeguard rejects demotion", async () => {
    db.user.findUnique
      .mockResolvedValueOnce({ role: "SUPER_ADMIN", tokenVersion: 7 })
      .mockResolvedValueOnce({ role: "SUPER_ADMIN" });
    db.user.count.mockResolvedValue(1);
    await expect(
      updateUser("target", { role: "USER" }, "actor", 7),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.user.update).not.toHaveBeenCalled();
  });
});
