# Transactional order emails

On-demand orders enqueue a PROCESSING event in the same transaction as their credit hold and durable fulfillment job. The order route sends it using Next.js `after()`. Successful fulfillment and full refunds enqueue COMPLETED/FAILED events in their respective transactions; provider calls happen only after commit. Instant inventory purchases do not receive collection-status emails.

## Configuration and rollout

- Apply the additive `20261010100000_add_order_email_outbox` migration and regenerate Prisma before deploying the app/worker. No historical orders are backfilled.
- Configure server-side `RESEND_API_KEY`, `EMAIL_FROM` using a verified Resend sender domain, and `NEXT_PUBLIC_APP_URL` with the production HTTPS origin. The existing onboarding sender fallback is for Resend testing, not general production delivery.
- Restart application and standalone fulfillment workers after configuration/client changes. Keep the authenticated fulfillment cron or persistent worker running: both retry due notifications even when no fulfillment jobs remain.
- No live mail is sent by the mocked test suite.

## Delivery behavior

The unique purchase/event outbox key, conditional 90-second lease, stored immutable payload, SENT marker, and stable Resend idempotency key prevent normal concurrent/replayed sends. Missing Resend configuration stays pending without reporting a successful send. Other failures use bounded backoff and eight attempts; EXHAUSTED notifications require operator review. Provider acceptance records `providerId` and `sentAt`; it does not prove inbox delivery.

Resend keeps idempotency keys for 24 hours. Ambiguous attempts stop automatic retries after 23 hours and enter NEEDS_REVIEW; review provider acceptance before any manual replay. The eight-second SDK timeout bounds caller waiting but cannot cancel the underlying Resend v4 request, so retry payloads/keys must not be changed. SENT events are not automatically resent after key expiry.

Stale PROCESSING events are skipped if the order has already reached a terminal state. Completion requires allocated entitlements, and refund notifications use the actual credits held by the fulfillment job. Email exceptions never change a committed purchase, trigger an extra refund, or expose credentials/provider details in logs. The Vault link uses the order reference ID because that is what the existing `?order=` filter matches.
