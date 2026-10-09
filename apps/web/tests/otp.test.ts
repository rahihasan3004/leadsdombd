import { beforeEach, describe, expect, it, vi } from "vitest";

interface TokenRow {
  id: string;
  identifier: string;
  token: string;
  expires: Date;
  failedAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
}

const { db, rows } = vi.hoisted(() => {
  const rows: TokenRow[] = [];
  let seq = 0;
  const verificationToken = {
    deleteMany: vi.fn(async ({ where }: { where: { identifier: string } }) => {
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i]?.identifier === where.identifier) rows.splice(i, 1);
      return { count: before - rows.length };
    }),
    create: vi.fn(async ({ data }: { data: Pick<TokenRow, "identifier" | "token" | "expires"> }) => {
      const row: TokenRow = { id: String(++seq), failedAttempts: 0, lockedUntil: null, createdAt: new Date(Date.now() + seq), ...data };
      rows.push(row);
      return row;
    }),
    findFirst: vi.fn(async ({ where }: { where: { identifier: string } }) =>
      rows.filter((r) => r.identifier === where.identifier).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null,
    ),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<TokenRow> }) => {
      const row = rows.find((r) => r.id === where.id);
      if (!row) throw new Error("not found");
      return Object.assign(row, data);
    }),
  };
  const db = {
    verificationToken,
    user: { updateMany: vi.fn(async () => ({ count: 1 })) },
    $transaction: vi.fn(),
  };
  return { db, rows };
});

vi.mock("@fine-leads/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fine-leads/database")>();
  return { ...actual, db };
});
vi.mock("@fine-leads/auth", () => ({ hashPassword: vi.fn(async (p: string) => `hashed:${p}`) }));

import { checkOtp, hashOtp, otpIdentifiers, storeOtp } from "@/lib/otp";
import { getAuthSecret } from "@fine-leads/auth/env";
import { POST as verifyCode } from "../app/api/auth/verify-code/route";
import { POST as resetPassword } from "../app/api/auth/reset-password/route";

let ipSeq = 0;
function post(body: unknown): Request {
  return new Request("https://app.test/api", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": `10.0.0.${++ipSeq}` },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  rows.length = 0;
  db.$transaction.mockImplementation(async (cb: (tx: typeof db) => unknown) => cb(db));
});

describe("lib/otp", () => {
  const id = otpIdentifiers.signup("user@test.dev");

  it("verifies a stored code without consuming it", async () => {
    await storeOtp(id, "123456");
    expect(await checkOtp(id, "123456")).toBe("ok");
    expect(await checkOtp(id, " 123456 ")).toBe("ok");
  });

  it("never stores the plain code", async () => {
    await storeOtp(id, "123456");
    expect(rows[0]?.token).not.toContain("123456");
    expect(rows[0]?.token).toBe(hashOtp("123456", id));
  });

  it("counts every failed attempt and locks after 5", async () => {
    await storeOtp(id, "123456");
    for (let i = 0; i < 4; i++) expect(await checkOtp(id, "000000")).toBe("invalid");
    expect(await checkOtp(id, "000000")).toBe("locked");
    // Correct code is refused while locked.
    expect(await checkOtp(id, "123456")).toBe("locked");
    expect(rows[0]?.failedAttempts).toBe(5);
  });

  it("rejects expired codes", async () => {
    await storeOtp(id, "123456");
    const row = rows[0];
    if (row) row.expires = new Date(Date.now() - 1000);
    expect(await checkOtp(id, "123456")).toBe("expired");
  });

  it("scopes codes by purpose and normalizes emails", async () => {
    await storeOtp(otpIdentifiers.signup("User@Test.dev "), "123456");
    expect(await checkOtp(otpIdentifiers.signup("user@test.dev"), "123456")).toBe("ok");
    expect(await checkOtp(otpIdentifiers.passwordReset("user@test.dev"), "123456")).toBe("invalid");
  });

  it("keys hashes with AUTH_SECRET and fails without one", () => {
    const original = process.env.AUTH_SECRET;
    const h1 = hashOtp("123456", id);
    process.env.AUTH_SECRET = "a-different-secret-0123456789abcdef0123";
    expect(hashOtp("123456", id)).not.toBe(h1);
    delete process.env.AUTH_SECRET;
    expect(() => getAuthSecret()).toThrow(/AUTH_SECRET/);
    expect(() => hashOtp("123456", id)).toThrow();
    process.env.AUTH_SECRET = original;
  });
});

describe("POST /api/auth/verify-code", () => {
  it("verifies the email and consumes the code", async () => {
    await storeOtp(otpIdentifiers.signup("new@test.dev"), "654321");
    const res = await verifyCode(post({ email: "New@Test.dev", code: "654321" }));
    expect(res.status).toBe(200);
    expect(db.user.updateMany).toHaveBeenCalledWith({
      where: { email: "new@test.dev", emailVerified: null },
      data: { emailVerified: expect.any(Date) },
    });
    expect(rows).toHaveLength(0);
  });

  it("rejects a password-reset code for email verification", async () => {
    await storeOtp(otpIdentifiers.passwordReset("new@test.dev"), "654321");
    const res = await verifyCode(post({ email: "new@test.dev", code: "654321" }));
    expect(res.status).toBe(400);
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });

  it("rejects non 6-digit codes before touching the database", async () => {
    const res = await verifyCode(post({ email: "new@test.dev", code: "12ab" }));
    expect(res.status).toBe(400);
    expect(db.verificationToken.findFirst).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/reset-password", () => {
  it("resets the password, revokes sessions and consumes the code", async () => {
    await storeOtp(otpIdentifiers.passwordReset("reset@test.dev"), "111222");
    const res = await resetPassword(post({ email: "reset@test.dev", code: "111222", newPassword: "N3w-password!" }));
    expect(res.status).toBe(200);
    expect(db.user.updateMany).toHaveBeenCalledWith({
      where: { email: "reset@test.dev" },
      data: { passwordHash: "hashed:N3w-password!", tokenVersion: { increment: 1 } },
    });
    expect(rows).toHaveLength(0);
  });

  it("does not reset with a wrong code and records the failed attempt", async () => {
    await storeOtp(otpIdentifiers.passwordReset("reset@test.dev"), "111222");
    const res = await resetPassword(post({ email: "reset@test.dev", code: "999999", newPassword: "N3w-password!" }));
    expect(res.status).toBe(400);
    expect(db.user.updateMany).not.toHaveBeenCalled();
    expect(rows[0]?.failedAttempts).toBe(1);
  });
});
