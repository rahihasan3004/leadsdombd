import type { SourceAdapter } from "../crawler.js";
import { GoogleMapsAdapter } from "./google-maps.adapter.js";
import { GoogleMapsCdpAdapter } from "./google-maps-cdp.adapter.js";

export { GoogleMapsAdapter, clearDedupCache } from "./google-maps.adapter.js";
export { GoogleMapsCdpAdapter } from "./google-maps-cdp.adapter.js";

/**
 * Factory: createGoogleMapsAdapter
 *
 * Instantiates a Google Maps source adapter variant:
 *   - "dom"   → DOM-based extraction (GoogleMapsAdapter)
 *   - "cdp"   → Protocol-level CDP network interception with DOM
 *               fallback (Akkhar-Magic architecture)
 *   - "hybrid"→ Same as "cdp" (Akkhar-Magic architecture)
 *
 * The "cdp" variant activates the Akkhar-Magic protocol interception
 * engine, bypassing presentation-layer DOM fragility by intercepting
 * Google Maps internal RPC payloads via Chrome DevTools Protocol.
 */
export function createGoogleMapsAdapter(
  variant: "dom" | "cdp" | "hybrid" = "dom",
): SourceAdapter {
  switch (variant) {
    case "cdp":
    case "hybrid":
      return new GoogleMapsCdpAdapter();
    case "dom":
    default:
      return new GoogleMapsAdapter();
  }
}