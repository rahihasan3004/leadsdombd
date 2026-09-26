# Akkhar-Magic CDP Google Maps Extractor

## Architecture in Short

- **Protocol-level interception:** Attaches Chrome DevTools Protocol (`Network.enable`) to capture Google Maps internal search RPC responses off the wire before DOM rendering.
- Strips Google anti-hijacking security prefix (`)]}'\n`) and parses raw structured arrays.
- **In-Flight Circuit Breaker Handover:** If CDP captures 0 records after scrolling (or encounters unexpected RPC formats), it immediately triggers the DOM parser (`extractListings`) on the already-loaded page as a fallback. Zero wasted navigation, zero dropped batches.
- **Attribution:** Adapted from Akkhar-Magic (`akkhar-labs/akkhar-magic`) by Akkhar-Labs (Rahat Hasan).

## Usage Guide

### Environment Toggle

Set `SCRAPER_ENGINE_VARIANT=cdp` in `.env` or CLI.

### Run Command

```bash
SCRAPER_ENGINE_VARIANT=cdp pnpm --filter @fine-leads/scraper-engine start
```

### Programmatic Factory

```typescript
import { createGoogleMapsAdapter } from "@fine-leads/scraper-engine";

const adapter = createGoogleMapsAdapter("cdp"); // or "dom" / "hybrid"
```