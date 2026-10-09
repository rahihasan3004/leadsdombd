/**
 * Auth environment validation. There are intentionally NO fallback secrets:
 * a missing secret must stop the server instead of silently signing sessions
 * and OTP hashes with a publicly known value.
 */

const MIN_SECRET_LENGTH = 32;

function readAuthSecret(): string {
  return (process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "").trim();
}

function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

/** Returns the auth secret or throws. Use for anything that signs/hashes with it. */
export function getAuthSecret(): string {
  const secret = readAuthSecret();
  if (!secret) {
    throw new Error(
      "[auth] AUTH_SECRET is not set. Generate one (e.g. `openssl rand -base64 32`) and add it to the environment."
    );
  }
  return secret;
}

/** Called once at server startup (instrumentation.ts). Throws if critical auth config is missing. */
export function assertAuthEnv(): void {
  const secret = getAuthSecret();
  if (secret.length < MIN_SECRET_LENGTH) {
    console.warn(`[auth] AUTH_SECRET is shorter than ${MIN_SECRET_LENGTH} characters; use a longer random value.`);
  }
}

/**
 * Secret for the NextAuth config. `next build` evaluates route modules without
 * runtime env, so only the build phase is allowed to proceed without one.
 */
export function resolveAuthSecretForConfig(): string | undefined {
  if (isBuildPhase()) return readAuthSecret() || undefined;
  return getAuthSecret();
}
