# Lobstr Google Maps ingestion

Server-only integration. Configure `LOBSTR_API_KEY` in `apps/web/.env.local` locally and in the web deployment's server environment. Never use a NEXT_PUBLIC variable. Optional `LOBSTR_GOOGLE_MAPS_CRAWLER_ID` overrides the documented crawler hash `4734d096159ef05210e0e1677e8be823`.

## Admin smoke test

With an authenticated ADMIN/SUPER_ADMIN session, send:

```text
POST /api/admin/scraper/test-lobstr?state=TX&city=Austin&limit=5
```

Category defaults to `real estate agents`. US state + city are required; limit is 1–100 (default 5). The route creates an isolated squid, configures it, adds a Google Maps search URL and dispatches one run. Website email extraction and business details consume Lobstr credits; inspect account pricing before dispatching. POSTs are deliberately not retried automatically.

Google Maps scrapes can exceed a serverless request lifetime. A `202` contains the run ID and resume URL. Poll the authenticated, read-only `GET /api/admin/scraper/test-lobstr?runId=...`, then `POST` that same URL to finish ingestion. Do NOT repeat the initial request: that starts another paid run. Only the initiating admin may resume the audited run. Persisted parameters are used on resume. Completed resumes return the saved summary rather than importing twice. Missing API key returns 503 without dispatch.

The route polls only within a short bounded budget; it is a smoke-test entrypoint, not a background scheduler. A full automated schedule requires a durable queue/cron consumer of this client. Run, squid, and audit records are retained for investigation; clean up old squids in Lobstr to avoid exhausting account slots. A lost dispatch response can leave a live run without an attached audit run ID: inspect Lobstr before attempting another kickoff.

## Mapping and safety

The mapper accepts JSON snake_case and CSV title-case labels, skips both kinds of closed places, rejects off-state/non-US results, validates URLs/email/US phone numbers, and preserves CID/reviews/source email status in `Agent.socialProfiles._lobstr` (no schema migration). Name is a Google Maps business name, not a fabricated individual agent identity. CID must be a string to preserve 64-bit precision.

Contacts are normalized. Serializable transactions with bounded conflict retries deduplicate by place ID, case-insensitive email, and historical formatted phone; existing Agents are never overwritten or downgraded. Phone-format comparison currently uses a PostgreSQL normalization expression; for large production backfills, introduce an indexed canonical-phone column in a separate migration. Each record commits independently; a failed request can be resumed safely. After a partial failure, the retry summary counts existing rows as duplicates, not as newly inserted in that retry.

Imported email is **unverified**: `isDeliverable=false`, `isVerified=false`, no SMTP verification date. Lobstr's email_status=valid and Google owner verification are not guarantees of SMTP deliverability. Phone-bearing rows can serve PHONE_ONLY inventory; VERIFIED_EMAIL inventory must go through the existing independent email verification process first. Source is `LOBSTR`; existing admin reports restricted to `SCRAPER_ENGINE` do not automatically include this new source.

## Official API contract

- https://docs.lobstr.io/docs/create-squid
- https://docs.lobstr.io/examples/google-maps-leads-scraper/update-settings
- https://docs.lobstr.io/examples/google-maps-leads-scraper/add-task-urls
- https://docs.lobstr.io/docs/start-run
- https://docs.lobstr.io/docs/get-run
- https://docs.lobstr.io/docs/get-results

Authorization is `Token`, not Bearer. Results are fetched by **run** only, with fixed-size pagination, after status DONE and export_done=true. GET responses can omit is_done; the client does not depend on it. HTTP calls have deadlines, reject redirects and never expose upstream response bodies/API keys in errors.
