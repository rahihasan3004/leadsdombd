/**
 * Runs once when the Next.js server starts. Fails fast if critical auth
 * configuration is missing, and loads the Sentry runtime configs (required
 * for @sentry/nextjs v8 server/edge instrumentation).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertAuthEnv } = await import("@fine-leads/auth/env");
    assertAuthEnv();
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
