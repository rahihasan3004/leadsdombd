# AGENTS.md — LeadsDom Development Guide

## Project Overview
**LeadsDom** (getleadsdom.com) is a B2B SaaS platform providing verified US Real Estate Agent data. Users buy credits, unlock leads by state, and export them as CSV.

## Tech Stack
- **Monorepo:** Turborepo + pnpm workspaces (TypeScript everywhere)
- **Web app:** Next.js 15 (App Router) + React 19
- **Styling:** Tailwind CSS v4 + shared components in `packages/ui` (Radix primitives)
- **Database:** PostgreSQL (Neon in production) + Prisma 6
- **Auth:** Auth.js v5 (NextAuth), JWT sessions, Google OAuth + email/password credentials with mandatory email verification (OTP)
- **Payments:** Lemon Squeezy (hosted checkout + HMAC-verified webhooks); pricing is computed server-side only
- **Email:** Resend, with inline HTML templates in `apps/web/src/lib/email.ts` (no React Email)
- **Rate limiting:** Upstash Redis via `@upstash/ratelimit`, with an automatic in-memory fallback
- **Client data/forms:** TanStack Query v5, React Hook Form + Zod
- **Monitoring:** Sentry
- **Tests:** Vitest (`apps/web/tests`, no network or database required)

## Directory Structure
```
├── apps/
│   └── web/                 # Next.js app
│       ├── app/             # App Router: pages, layouts, API routes
│       ├── src/components/  # Feature components
│       ├── src/lib/         # Server helpers (payments, OTP, email, rate-limit response)
│       └── tests/           # Vitest unit tests
├── packages/
│   ├── auth/                # Auth.js config & helpers (requireAdmin, hashing)
│   ├── config/              # Shared ESLint (flat config) + TypeScript configs
│   ├── database/            # Prisma schema, migrations, client singleton
│   ├── ui/                  # Shared UI components + Tailwind globals
│   ├── utils/               # Formatters, pricing tiers, order refs; server-only rate limiter
│   └── scraper-engine/      # Legacy Google Maps scraper (not deployed, see below)
├── docker/                  # Dockerfile (Next.js standalone) + docker-compose (Postgres + app)
├── .github/workflows/       # CI: lint, typecheck, tests, build
├── turbo.json
└── pnpm-workspace.yaml
```

## Commands

### Development
```bash
pnpm docker:up            # Start local PostgreSQL (+ app container)
pnpm db:generate          # Generate Prisma client
pnpm db:migrate           # Create a migration (dev)
pnpm db:migrate:deploy    # Apply migrations (production)
pnpm db:studio            # Open Prisma Studio
pnpm dev                  # Start apps in dev mode
pnpm build                # Build all packages and apps
```

### Quality
```bash
pnpm lint                 # ESLint 9 (flat config) across all packages
pnpm typecheck            # tsc --noEmit across all packages
pnpm test                 # Vitest unit tests (apps/web)
pnpm format               # Prettier
```

## Environment Variables
Copy `.env.example` to `.env` and fill in real values. **Never commit real secrets**, `.env.example` must only contain placeholders. `turbo.json` (`globalEnv`) lists every variable the build uses. Key groups:
- `DATABASE_URL`, `DIRECT_URL`: Postgres
- `AUTH_SECRET` (required; enforced at startup in `instrumentation.ts`), `AUTH_GOOGLE_ID/SECRET`
- `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET`, `LEMONSQUEEZY_*_VARIANT_ID`
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`: optional locally; set them in production
- `SENTRY_DSN`

## Architecture Notes

### Shared packages
`database`, `auth`, `ui`, and `utils` are consumed by the web app as TypeScript source (no build step). Anything imported from the `@fine-leads/utils` barrel must stay browser-safe; server-only code lives behind subpaths (e.g. `@fine-leads/utils/rate-limit`).

### Data model
Schema: `packages/database/prisma/schema.prisma`. Migrations are baselined at `0_init`. Key entities:
- `User`, `Organization`
- `Agent`: the lead record (core data product)
- `LeadPurchase` / `UnlockedLead`: what a user has bought and unlocked, per state
- `WalletTransaction`: credit ledger
- `LeadExport`: CSV export history
- `AuditLog`: security/audit trail

### Auth
Auth.js v5 with JWT strategy, configured in `packages/auth`. Admin routes are guarded server-side with `requireAdmin()` in the admin layout. OTP flows (signup verification, password reset, email change, account deletion) all go through `apps/web/src/lib/otp.ts`.

### Payments (Lemon Squeezy)
- `POST /api/lemon-squeezy/checkout`: creates a checkout; amounts and credits come from `VOLUME_PRICING_TIERS` on the server, never from the client.
- `POST /api/lemon-squeezy/webhook`: verifies the HMAC signature (no fallback secret) and handles duplicates and refunds idempotently.
- `POST /api/purchases/order`: spends credits to unlock leads inside a Prisma transaction (atomic, no double-spend).

### Rate limiting
`checkRateLimit()` in `@fine-leads/utils/rate-limit` (async) uses Upstash Redis when both env vars are set, otherwise an in-memory fixed window. Redis errors or responses slower than 1.5s fall back to memory, so limits degrade instead of disappearing. API routes use `rateLimitOrNull()` from `apps/web/src/lib/rate-limit-response.ts` to return a `429` with `Retry-After`.

### Exports
`GET /api/exports/stream?state=XX[&purchaseId=...]` streams a CSV of the user's unlocked, deliverable leads and records a `LeadExport`. It's used by `/dashboard/exports` and `/dashboard/lists`.

### Main API routes (`apps/web/app/api`)
- `auth/*`: signup, OTP verification, password reset, and the Auth.js handler
- `agents`, `leads/stats`, `analytics`, `dashboard/metrics`: search and metrics
- `purchases`, `purchases/order`, `billing/*`: orders, wallet, transactions
- `lemon-squeezy/*`: checkout + webhook
- `exports/stream`: CSV export
- `user/*`: profile, password, email change, account deletion
- `admin/*`: admin console (guarded)

### Lead data ingestion
Production lead data is ingested from **Lobstr** (lobstr.io) via its API, and leads pass SMTP email verification before they are saved to Postgres. There's no scraper worker, browser container, or job queue in the deployed stack, and the Docker image intentionally excludes Playwright.

### Scraper engine (legacy, not deployed)
`packages/scraper-engine` contains the earlier Playwright-based Google Maps scraper. It is kept in the repo but not built into the web image. Adapter variants are selected with `SCRAPER_ENGINE_VARIANT`:
- **`dom`** (default): DOM-based extraction from rendered page content.
- **`cdp`**: CDP network interception with a DOM fallback, using the **Akkhar-Magic** architecture.
- **`hybrid`**: alias for `cdp`.

The CDP architecture is inspired by and adapted from
[**Akkhar-Magic**](https://github.com/akkhar-labs/akkhar-magic)
(`akkhar-labs/akkhar-magic`), developed by Akkhar-Labs (Rahat Hasan).
