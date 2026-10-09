# On-demand order fulfillment

## Deployment gate

1. Apply `pnpm db:migrate:deploy`, then generate Prisma (`pnpm db:generate`). The additive migration adds PROCESSING, the purchase's latest `lobstrRunId`, and durable job/run/candidate tables. Historical purchases remain unchanged.
2. Configure server-side `LOBSTR_API_KEY` and start a durable worker or schedule the authenticated poller below.
3. Only after the consumer is running, set `LOBSTR_FULFILLMENT_ENABLED=true` in the web environment. Without both this flag and an API key, shortage orders return 503 and deduct no credits. Existing sufficient inventory still fulfills without Lobstr configuration.

The inventory freshness window is 90 days: source scrape time, email-verification time, or ingestion time if both are missing. Inventory must match the selected tier and not already belong to that user. Leads remain reusable by different customers; this is not globally exclusive inventory.

## Persistent worker (recommended for both tiers)

From the repository root, on a host that permits outbound SMTP port 25:

```text
pnpm --filter @fine-leads/database exec node --env-file=.env --env-file-if-exists=../../apps/web/.env.local --import tsx ../../apps/web/scripts/lobstr-fulfillment-worker.ts
```

Supply deployment environment variables instead of local env files in production. `--once` advances one stage and exits. Run under a service/process supervisor for automatic restart; multiple instances safely compete through DB leases. Shutdown finishes the bounded current stage and disconnects Prisma.

The worker uses the existing SmtpValidator with port 25 explicitly (its historical default is 587). Only matching-email deliverable/validated + SMTP 250/251 + non-catch-all/non-disposable outcomes qualify. MX-only outcomes may have isDeliverable=true in the legacy validator; the fulfillment gate deliberately rejects them. No finite SMTP check is a future guarantee against mailbox changes/bounces.

## HTTP poller alternative

Configure a strong `CRON_SECRET` and schedule either method:

```text
GET /api/cron/lobstr-fulfillment
Authorization: Bearer <CRON_SECRET>
```

POST is also accepted. Each invocation advances one job/stage; use a recurring scheduler, not a user navigation request. An example Vercel cron entry is `{ "path": "/api/cron/lobstr-fulfillment", "schedule": "* * * * *" }` in the project's `vercel.json`; use an appropriate Vercel plan/frequency, or an external scheduler. No cron subscription or deployment is automatically provisioned by these source changes.

The HTTP poller handles dispatch/ingestion/phone fulfillment but intentionally does not open SMTP sockets from Vercel. VERIFIED_EMAIL orders wait for the persistent SMTP-capable worker (or independently verified eligible inventory); they cannot complete just because Lobstr found an email.

## Lifecycle and financial safety

- Enough qualified inventory: one transaction debits the requested tier cost, allocates exactly the requested count, and completes the purchase.
- Shortage: one transaction deducts the full requested amount as a credit hold, writes a PROCESSING purchase, and enqueues its job/run plan. No partial leads are exposed or CSV-downloadable.
- Next.js `after()` immediately advances this purchase’s durable job after returning 202; a recurring consumer is still required for polling, recovery and verification. A failed after registration cannot turn an accepted debit into a misleading HTTP error. Background runs split the requested lead volume across states (rather than subtracting existing inventory, since results can overlap/deduplicate), at most 10,000 results per run. State-wide Google Maps search URLs are used, not an invented representative city. State-wide coverage is provider-limited; a target count is not a guaranteed result count.
- Every run ID is persisted on its run record; the purchase `lobstrRunId` retains the latest one for compatibility. API calls never occur inside a DB transaction. Completed exports are paged at a fixed size; per-row checkpoints and candidate joins recover interruptions without losing deduplicated leads.
- Full allocation, COMPLETED status, and hold settlement are atomic. No second debit at fulfillment. Existing Agents are not overwritten by ingestion; explicit negative verification results mark the matching email non-deliverable; PHONE_ONLY email masking remains at all server export boundaries.
- Exhausted/failed provider results, eight consecutive transient failures, or the 24-hour deadline release the **entire held amount** through a conditional PROCESSING→REFUNDED transaction. Repeated poller requests cannot refund twice. No partially fulfilled order is silently marked complete.
- A persisted DISPATCHING run after an interruption becomes UNKNOWN/NEEDS_REVIEW. Lobstr has no documented dispatch idempotency key, so a potentially chargeable POST is never blindly replayed. Inspect that account's runs before reconciling operationally; unresolved jobs expire/refund automatically. Already-dispatched provider runs may continue and incur provider charges even if shared inventory later completes or refunds the customer order; inspect/cancel them in Lobstr as appropriate.
- The Vault lists processing/refunded orders, polls the visible current page every 15 seconds while it contains a processing order, shows a reduced-motion-friendly collecting badge and disables view/download actions until completion. The server still rejects non-completed detail/download requests.

Only small summaries/statuses appear in user APIs. Job leases/checkpoints, errors (codes only), and candidate IDs stay server-side. This implementation uses a secret-authenticated poller rather than trusting unauthenticated webhook payloads.
