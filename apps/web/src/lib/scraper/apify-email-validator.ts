import { resolveMx } from "node:dns/promises";
import { db } from "@fine-leads/database";
import { z } from "zod";
import { apifyEmailMode, validExtractedEmail } from "./apify-email-policy";
import { isSmtpDeliverable } from "./fulfillment-policy";
export interface ApifyEmailValidation {
  status: string;
  eligible: boolean;
  verified: boolean;
}
/** Modular serverless-safe validator: no local SMTP socket is ever opened. */
export async function validateApifyEmail(
  email: string,
): Promise<ApifyEmailValidation> {
  if (!validExtractedEmail(email))
    return { status: "invalid_syntax", eligible: false, verified: false };
  const mode = apifyEmailMode();
  if (mode === "syntax")
    return { status: "syntax_valid", eligible: true, verified: false };
  if (mode === "mx") {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const records = await Promise.race([
        resolveMx(email.split("@")[1]!),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("MX validation timed out")),
            5000,
          );
        }),
      ]);
      const eligible = records.some(
        (record) => record.exchange && record.exchange !== ".",
      );
      return {
        status: eligible ? "mx_valid" : "no_mx",
        eligible,
        verified: false,
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOTFOUND" || code === "ENODATA")
        return { status: "no_mx", eligible: false, verified: false };
      throw error; // Transient DNS failure retries; never silently weakens validation.
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  // Optional dedicated Validator API/VPS adapter. Configure only a trusted HTTPS service.
  const url = new URL(process.env.APIFY_EMAIL_VALIDATOR_URL ?? "");
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("Validator requires a trusted HTTPS URL");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(process.env.APIFY_EMAIL_VALIDATOR_TOKEN
          ? {
              Authorization: `Bearer ${process.env.APIFY_EMAIL_VALIDATOR_TOKEN}`,
            }
          : {}),
      },
      body: JSON.stringify({ email }),
    });
    if (!response.ok)
      throw new Error(`Email validator failed (HTTP ${response.status})`);
    const result = z
      .object({
        email: z.string(),
        status: z.string(),
        isDeliverable: z.boolean(),
        isCatchAll: z.boolean(),
        isDisposable: z.boolean(),
        smtpCode: z.number().int().nullable(),
      })
      .parse(await response.json());
    if (result.email.trim().toLowerCase() !== email.trim().toLowerCase())
      throw new Error("Validator email mismatch");
    const verified = isSmtpDeliverable(result, email);
    if (
      !verified &&
      ![
        "undeliverable",
        "catch-all",
        "disposable",
        "invalid_syntax",
        "no_mx",
      ].includes(result.status)
    )
      throw new Error("Email validator returned an inconclusive result");
    return {
      status: verified ? "deliverable" : result.status,
      eligible: verified,
      verified,
    };
  } finally {
    clearTimeout(timer);
  }
}
/** Compare-and-set prevents stale checks overwriting edited addresses or stronger evidence. */
export async function validateExistingApifyEmail(
  id: string,
  email: string,
  validation?: ApifyEmailValidation,
) {
  const result = validation ?? (await validateApifyEmail(email));
  await db.agent.updateMany({
    where: {
      id,
      email,
      dataSource: "APIFY",
      OR: [
        { emailStatus: null },
        {
          emailStatus: {
            in: ["unverified", "unknown", "syntax_valid", "mx_valid"],
          },
        },
      ],
    },
    data: {
      emailStatus: result.status,
      isDeliverable: result.eligible,
      isVerified: result.verified,
      verificationScore: result.verified ? 100 : 0,
      lastVerifiedAt: result.verified ? new Date() : null,
    },
  });
  return result;
}
