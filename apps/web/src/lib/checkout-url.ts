const FALLBACK_APP_URL = "https://leadsdombd-web.vercel.app";
const OBSOLETE_APP_HOST = "leadsdomusa.vercel.app";

/** Use trusted deployment configuration, never client-supplied redirect hosts. */
export function getCheckoutRedirectUrl(): string {
  let appUrl = FALLBACK_APP_URL;
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (
        (url.protocol === "https:" || url.protocol === "http:") &&
        !url.username &&
        !url.password &&
        url.hostname !== OBSOLETE_APP_HOST
      ) {
        // Discard trailing slashes, paths, queries and fragments from the base.
        appUrl = url.origin;
      }
    } catch {
      // Invalid deployment configuration must not break checkout or its return URL.
    }
  }
  return `${appUrl}/dashboard/billing?status=success`;
}
