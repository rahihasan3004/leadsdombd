# Apify Compass integration

Uses typed REST calls; no SDK dependency is required. Target actor: `compass/crawler-google-places`.

## Configuration

- `APIFY_TOKENS`: comma-separated, server-only tokens from accounts you are authorized to use. `APIFY_TOKEN` is the single-token fallback. Never use a `NEXT_PUBLIC_` prefix.
- `APIFY_FULFILLMENT_ENABLED=true` and `SCRAPER_PROVIDER=apify`: primary provider for new shortage jobs.
- Alternatively, keep Lobstr primary and set `SCRAPER_FALLBACK_PROVIDER=apify`. Fallback is allowed only when a Lobstr dispatch was definitely rejected or is unconfigured. Ambiguous paid POSTs and quota/rate-limit failures do not trigger fallback.
- `APIFY_MAX_RUN_CHARGE_USD=1`: conservative per-run spend ceiling; adjust explicitly for production volumes.
- `APIFY_SCRAPE_CONTACTS=true`: optional paid website/contact enrichment; defaults off. Discovered email is never treated as SMTP-verified.

Defaults preserve existing Lobstr behavior. Apify-selected new jobs use the existing durable serial fulfillment pipeline. Lobstr's 50-slot parallel capacity reservation is not applied to Apify. Existing Lobstr parallel jobs continue with Lobstr; they are not migrated in flight.

## Tokens and availability

The pool performs synchronous round-robin selection and deduplicates tokens. An explicit 401 disables a credential and permits a different authorized credential. A 402 pauses all new dispatches until billing is replenished and the process/pool is reset. Pinned read-only polling/dataset requests can still complete already-paid runs when the provider permits those reads. A 429 honors Retry-After with a pool cooldown; it never rotates tokens to bypass a provider limit. Availability state is per process, not a distributed/account-level quota tracker. Configure shared Upstash rate limiting for the admin route in production. Each provider call still enforces Apify's own limits.

Run references store `apify:<SHA256-token-fingerprint>:<run-id>` in the existing unique runId column. No raw token is persisted. The owning credential remains pinned for polling/dataset reads, even after token reordering or app restarts. Keep old credentials configured until their outstanding runs finish. Existing purchase `lobstrRunId` is a legacy field name and can hold this opaque provider reference; no Prisma migration is needed.

No automatic retry of an ambiguous paid actor POST: a timeout/5xx/malformed response may hide a successful charge. Fulfillment marks these runs NEEDS_REVIEW under its existing lease and dispatch checkpoint. Restarting/retrying such a run requires operator reconciliation.

## Admin smoke test

Use an authenticated admin **POST**, not GET:

`/api/admin/scraper/test-apify?state=TX&city=Austin&limit=5`

Returns 202 and an opaque runReference while running. Repeat POST with the same state/city/limit and `&runReference=<returned-reference>` to poll and ingest the completed first page. No extra actor run is started. Limits are 1–25 records, two starts/minute/admin and 20 polls/minute/admin. Permanent/temporary closures and mismatched states are discarded; replayed place/email/normalized phone records are skipped by the shared serializable ingestion deduplicator.

The mapper uses the actual Prisma names (`fullName`, `brokerageAddress`, `websiteUrl`, `googlePlaceId`, `socialProfiles`). ZIPs remain strings; email/social export redaction is unchanged. Tier 2 allocation still requires the existing independent SMTP verification pipeline.

Tests are mocked. Deployment, live token validation and a paid actor smoke test are separate operator steps.
