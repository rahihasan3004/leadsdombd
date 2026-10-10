import { z } from "zod";
/** These statuses mean staged eligibility, NOT proven mailbox deliverability. */
export const APIFY_STAGED_STATUSES = ["syntax_valid", "mx_valid"];
export function apifyEmailMode(): "syntax" | "mx" | "api" {
  return z
    .enum(["syntax", "mx", "api"])
    .parse(process.env.APIFY_EMAIL_VALIDATION_MODE ?? "syntax");
}
export function stagedEmailStatuses(): string[] {
  const mode = apifyEmailMode();
  return mode === "syntax"
    ? APIFY_STAGED_STATUSES
    : mode === "mx"
      ? ["mx_valid"]
      : [];
}
export function validExtractedEmail(email: string): boolean {
  if (!z.string().email().max(254).safeParse(email).success) return false;
  const [local, domain] = email.split("@");
  if (!local || local.length > 64 || !domain || domain.length > 253)
    return false;
  const labels = domain.split(".");
  return (
    labels.length >= 2 &&
    labels.every((label) =>
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label),
    ) &&
    /^[a-z]{2,63}$/i.test(labels.at(-1)!)
  );
}
export function apifyCandidateLimit(quantity: number, tier?: string): number {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000)
    throw new Error("Invalid Apify quantity");
  return tier === "VERIFIED_EMAIL"
    ? Math.max(Math.ceil(quantity * 3.5), 40)
    : quantity;
}
