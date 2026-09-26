# AGENTS.md — LeadsDom Development Guide

## Project Overview
**LeadsDom** (getleadsdom.com) is a B2B SaaS platform providing verified US Real Estate Agent data intelligence. The platform enables real estate professionals to search, filter, and export agent data for lead generation.

## Tech Stack
- **Monorepo:** Turborepo + pnpm workspaces
- **Frontend:** Next.js 15 (App Router) + React 19 + TypeScript
- **Styling:** TailwindCSS v4 + shadcn/ui (Radix primitives)
- **Database:** PostgreSQL 16 + Prisma ORM
- **Auth:** Auth.js v5 (NextAuth) with Google OAuth + Credentials
- **Payments:** Stripe (subscriptions via Checkout)
- **State:** TanStack Query v5
- **Forms:** React Hook Form + Zod
- **Email:** Resend (via React Email)
- **Caching:** Redis (Upstash)
- **Monitoring:** Sentry

## Directory Structure
```
├── apps/
│   └── web/          # Next.js 15 application
│       ├── app/      # App Router (layouts, pages, API routes)
│       └── src/
│           └── components/  # Feature components
├── packages/
│   ├── auth/         # Auth.js configuration & helpers
│   ├── config/       # Shared ESLint + TypeScript configs
│   ├── database/     # Prisma schema & client singleton
│   ├── ui/           # shadcn/ui components + Tailwind globals
│   └── utils/        # Shared utilities (cn, formatters, validators)
├── docker/           # Dockerfile + docker-compose
├── .github/          # CI/CD workflows
├── turbo.json        # Turborepo pipeline
└── pnpm-workspace.yaml
```

## Commands

### Development
```bash
pnpm docker:up       # Start PostgreSQL + Redis
pnpm db:generate     # Generate Prisma client
pnpm db:push         # Push schema to DB (dev)
pnpm db:migrate      # Create migration (production)
pnpm db:studio       # Open Prisma Studio
pnpm dev             # Start all apps in dev mode
pnpm build           # Build all packages and apps
```

### Quality
```bash
pnpm lint            # Lint all packages
pnpm typecheck       # TypeScript check all packages
pnpm format          # Format with Prettier
```

## Environment Variables
Copy `.env.example` to `.env` and fill in required values. See `turbo.json` for the full list of environment variables declared for the build pipeline.

## Architecture Decisions

### Why Turborepo?
Monorepo with shared packages avoids duplication. The `database`, `auth`, `ui`, and `utils` packages are consumed by the web app with zero build overhead via TypeScript source imports.

### Data Model
The Prisma schema is in `packages/database/prisma/schema.prisma`. Key entities:
- `Organization` — tenant/account
- `User` — authenticated user linked to an org
- `Agent` — real estate agent record (the core data product)
- `Subscription` — billing record linked to Stripe
- `SearchHistory` — logged searches for analytics/compliance
- `SavedList` — saved filter queries
- `LeadExport` — export jobs (CSV/Excel/JSON)
- `ApiKey` — programmatic access keys
- `AuditLog` — security/audit trail

### Auth Flow
Auth.js v5 with JWT strategy. The `auth.ts` config in `packages/auth` is imported by both the `middleware.ts` (for route protection) and API routes (for session validation).

### Stripe Integration
- `POST /api/stripe/checkout` — Creates a Checkout Session
- `POST /api/stripe/webhook` — Handles webhook events (checkout completed, subscription updated/deleted, payment failed)
- `POST /api/stripe/portal` — Creates a Customer Portal session for billing management

### API Design
All API routes under `app/api/` follow REST conventions:
- `GET /api/agents` — search agents with filters
- `GET /api/agents/[id]` — get single agent detail
- `POST /api/lists` — create saved list
- `GET /api/lists` — get user saved lists
- `POST /api/auth/signup` — register new user
- `/api/auth/[...nextauth]` — Auth.js route handler

### Scraper Engine (Google Maps Adapters)
The scraper engine supports multiple adapter variants for Google Maps data
extraction, selectable via the environment variable `SCRAPER_ENGINE_VARIANT`:
- **`dom`** (default) — Traditional DOM-based extraction from rendered page content.
- **`cdp`** — Protocol-level CDP network interception with in-flight circuit-breaker
  DOM fallback. This variant activates the **Akkhar-Magic** architecture, which
  intercepts Google Maps internal RPC response payloads directly off the wire
  via Chrome DevTools Protocol, bypassing presentation-layer DOM fragility.
- **`hybrid`** — Alias for `cdp`, same Akkhar-Magic architecture.

The CDP architecture is inspired by and adapted from
[**Akkhar-Magic**](https://github.com/akkhar-labs/akkhar-magic)
(`akkhar-labs/akkhar-magic`), developed by Akkhar-Labs (Rahat Hasan).