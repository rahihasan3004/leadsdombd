import crypto from "crypto";
import { db } from "@fine-leads/database";

export const OTP_TTL_MS = 15 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const LOCK_MS = 60 * 60 * 1000;

/**
 * Purpose-scoped identifiers. Each flow gets its own namespace so a code issued
 * for one purpose (signup, password reset, email change, deletion) can never be
 * replayed in another, and requesting one code never wipes out another.
 */
export const otpIdentifiers = {
  emailChangeCurrent: (userId: string) => `email-change:current:${userId}`,
  emailChangeNew: (userId: string, newEmail: string) => `email-change:new:${userId}:${newEmail}`,
  deleteAccount: (userId: string) => `delete-account:${userId}`,
};

const OTP_SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";

export function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashOtp(otp: string, identifier: string): string {
  // Keyed with the server secret so leaked hashes can't be brute-forced offline.
  return crypto
    .createHmac("sha256", OTP_SECRET || identifier)
    .update(`${identifier}:${otp}`)
    .digest("hex");
}

type Tx = Pick<typeof db, "verificationToken">;

/** Replace any existing code for this identifier with a fresh one. */
export async function storeOtp(identifier: string, otp: string, client: Tx = db) {
  await client.verificationToken.deleteMany({ where: { identifier } });
  await client.verificationToken.create({
    data: { identifier, token: hashOtp(otp, identifier), expires: new Date(Date.now() + OTP_TTL_MS) },
  });
}

export type OtpCheck = "ok" | "invalid" | "expired" | "locked";

/** Verify a code and count failed attempts (locks after MAX_OTP_ATTEMPTS). Does not consume the code. */
export async function checkOtp(identifier: string, code: string): Promise<OtpCheck> {
  const record = await db.verificationToken.findFirst({
    where: { identifier },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return "invalid";
  if (record.lockedUntil && record.lockedUntil > new Date()) return "locked";
  if (record.expires <= new Date()) return "expired";

  const expected = Buffer.from(record.token, "hex");
  const actual = Buffer.from(hashOtp(String(code), identifier), "hex");
  const matches = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  if (matches) return "ok";

  const failedAttempts = record.failedAttempts + 1;
  await db.verificationToken.update({
    where: { id: record.id },
    data: {
      failedAttempts,
      lockedUntil: failedAttempts >= MAX_OTP_ATTEMPTS ? new Date(Date.now() + LOCK_MS) : null,
    },
  });
  return failedAttempts >= MAX_OTP_ATTEMPTS ? "locked" : "invalid";
}

export function otpErrorMessage(result: Exclude<OtpCheck, "ok">, label: string): string {
  switch (result) {
    case "expired":
      return `The ${label} code has expired. Please request a new one.`;
    case "locked":
      return `Too many incorrect attempts for the ${label} code. Please request a new code later.`;
    default:
      return `Invalid ${label} code.`;
  }
}
