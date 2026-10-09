# Lobstr operational recovery

Run from the repository root with server environment variables (the local example below loads web credentials, then applies `packages/database/.env` last to preserve the intended database target). Never commit API keys or put them in CLI arguments.

```text
pnpm --filter @fine-leads/database exec node --env-file="D:\Fine Leads\apps\web\.env.local" --env-file="D:\Fine Leads\packages\database\.env" --import tsx ../../apps/web/scripts/recover-lobstr.ts refund --reference LD-ORD-67FFZR9Z --confirm-no-run
pnpm --filter @fine-leads/database exec node --env-file="D:\Fine Leads\apps\web\.env.local" --env-file="D:\Fine Leads\packages\database\.env" --import tsx ../../apps/web/scripts/recover-lobstr.ts ingest --run 55f87ff15cf944819dd5f8b53769c245 --squid 1d332f09180547228dfb3417248996a5 --dry-run
```

Remove `--dry-run` to ingest. Refund requires explicit operator confirmation that no provider run exists, validates the recorded hold, claims a durable lease and uses the conditional refund transaction. Re-running an already-refunded order does not credit the wallet again. Unfinished run rows are failed in the same settlement transaction. The failure notification is queued durably and delivery occurs after commit.

Ingestion verifies the run/squid association and completed export, maps each record with its actual source US state, and deduplicates using the existing mapper. It never attaches inventory to a cancelled order, creates new scrapes, or upgrades scraped email claims to SMTP verification. Email-enriched Lobstr exports can contain several rows for one business; those remain one Agent with its primary email, not one new Agent per email. Raw contacts and provider bodies are not logged.

## Production dispatch

Set `LOBSTR_API_KEY`, `LOBSTR_FULFILLMENT_ENABLED=true`, and `CRON_SECRET` in the Vercel production environment and redeploy. Local env changes do not configure Vercel. Preserve the configured two-minute cron (supported Vercel plan/external scheduler) and deploy an SMTP-capable worker for VERIFIED_EMAIL orders.

The client reports setup phase, safe error code and HTTP status. The worker logs purchase/run/squid IDs and whether dispatch is retryable or uncertain, without tokens or raw provider messages. Missing configuration after accepting a hold and terminal explicit dispatch rejections release credits. Transient failures before `/runs` and explicit 429 rejections requeue with bounded backoff. A timeout, malformed success, 408/409 or 5xx at the chargeable `/runs` POST stays UNKNOWN/NEEDS_REVIEW: do not replay it without reconciliation. Setup retries can leave unused squids; review/clean those in Lobstr rather than treating them as paid runs.

Use absolute env-file paths when invoking pnpm/Node on Windows. Relative env-file paths can be interpreted before the workspace cwd changes; use the same explicit configuration for interactive and detached jobs. Refund email delivery stays pending if the selected runtime has no Resend credentials.
