import crypto from "crypto";
import { db, Prisma } from "@fine-leads/database";
import { getAuthSecret } from "@fine-leads/auth/env";

export const OTP_TTL_MS = 15 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const LOCK_MS = 60 * 60 * 1000;

/**
 * Purpose-scoped identifiers. Each flow gets its own namespace so a code issued
 * for one purpose (signup, password reset, email change, deletion) can never be
 * replayed in another, and requesting one code never wipes out another.
 */
export const otpIdentifiers = {
  signup: (email: string) => `signup:${normalizeEmail(email)}`,
  passwordReset: (email: string) => `password-reset:${normalizeEmail(email)}`,
  emailChangeCurrent: (userId: string) => `email-change:current:${userId}`,
  emailChangeNew: (userId: string, newEmail: string) =>
    `email-change:new:${userId}:${newEmail}`,
  deleteAccount: (userId: string) => `delete-account:${userId}`,
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashOtp(otp: string, identifier: string): string {
  // Keyed with the server secret so leaked hashes can't be brute-forced offline.
  return crypto
    .createHmac("sha256", getAuthSecret())
    .update(`${identifier}:${otp}`)
    .digest("hex");
}

type Tx = Pick<Prisma.TransactionClient, "verificationToken" | "$queryRaw">;
async function lockOtp(client: Tx, identifier: string) {
  await client.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`otp:${identifier}`}, 0))`;
}
export async function storeOtp(identifier: string, otp: string, client?: Tx) {
  const store = async (tx: Tx) => {
    await lockOtp(tx, identifier);
    await tx.verificationToken.deleteMany({ where: { identifier } });
    await tx.verificationToken.create({
      data: {
        identifier,
        token: hashOtp(otp, identifier),
        expires: new Date(Date.now() + OTP_TTL_MS),
      },
    });
  };
  if (client) await store(client);
  else
    await db.$transaction(store, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });
}
export type OtpCheck = "ok" | "invalid" | "expired" | "locked";
async function checkLocked(
  tx: Tx,
  identifier: string,
  code: string,
): Promise<OtpCheck> {
  const record = await tx.verificationToken.findFirst({
    where: { identifier },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return "invalid";
  const now = new Date();
  if (record.lockedUntil && record.lockedUntil > now) return "locked";
  if (record.expires <= now) return "expired";
  const expected = Buffer.from(record.token, "hex");
  const actual = Buffer.from(hashOtp(String(code).trim(), identifier), "hex");
  if (
    expected.length === actual.length &&
    crypto.timingSafeEqual(expected, actual)
  )
    return "ok";
  const failedAttempts = record.failedAttempts + 1;
  await tx.verificationToken.update({
    where: { id: record.id },
    data: {
      failedAttempts: { increment: 1 },
      lockedUntil:
        failedAttempts >= MAX_OTP_ATTEMPTS
          ? new Date(Date.now() + LOCK_MS)
          : null,
    },
  });
  return failedAttempts >= MAX_OTP_ATTEMPTS ? "locked" : "invalid";
}
/** Non-consuming preview. Final mutations MUST use withVerifiedOtps, not this preview. */
export async function checkOtp(
  identifier: string,
  code: string,
): Promise<OtpCheck> {
  return db.$transaction(
    async (tx) => {
      await lockOtp(tx, identifier);
      return checkLocked(tx, identifier, code);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}
/** Failed attempts commit; successful consumption and the protected action commit together.
 * Sorted locks make two-code email changes safe against deadlocks and replay. */
export async function withVerifiedOtps<T>(
  codes: { identifier: string; code: string; label: string }[],
  action: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<{ result: OtpCheck; label?: string; value?: T }> {
  return db.$transaction(
    async (tx) => {
      for (const identifier of [
        ...new Set(codes.map((c) => c.identifier)),
      ].sort())
        await lockOtp(tx, identifier);
      for (const c of codes) {
        const result = await checkLocked(tx, c.identifier, c.code);
        if (result !== "ok") return { result, label: c.label };
      }
      const value = await action(tx);
      for (const c of codes)
        await tx.verificationToken.deleteMany({
          where: {
            identifier: c.identifier,
            token: hashOtp(c.code.trim(), c.identifier),
          },
        });
      return { result: "ok", value };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}

export function otpErrorMessage(
  result: Exclude<OtpCheck, "ok">,
  label: string,
): string {
  switch (result) {
    case "expired":
      return `The ${label} code has expired. Please request a new one.`;
    case "locked":
      return `Too many incorrect attempts for the ${label} code. Please request a new code later.`;
    default:
      return `Invalid ${label} code.`;
  }
}

/** Shared zod-friendly shape for 6-digit codes. */
export const OTP_CODE_REGEX = /^\d{6}$/;
