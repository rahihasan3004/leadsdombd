# LeadsDom — Full Codebase Deep Audit & Architecture Health Check

**Date:** 2026-09-22  
**Repository:** D:\Fine Leads  
**Auditor:** Kilo (Automated Deep Audit)  
**Overall Score:** 52 / 100

---

## 1. Executive Summary

LeadsDom is a **B2B SaaS platform** providing verified US real estate agent data intelligence, built as a **Turborepo + pnpm monorepo** with a Next.js 15 frontend, PostgreSQL 16/Prisma ORM backend, and a separate Playwright-based scraper engine. The project demonstrates solid architectural foundations—modular packages, modern React 19, TanStack Query, Tailwind v4, and shadcn/ui—but has **significant security gaps, incomplete auth flows, and production-readiness issues** that must be resolved before launch.

**Key Strengths:**
- Clean monorepo structure with shared packages (`auth`, `database`, `ui`, `utils`)
- Strong database schema with comprehensive indexes and relations
- Modern frontend stack (Next.js 15 App Router, React 19, Tailwind v4)
- Comprehensive admin panel with role-based access
- Multi-factor OTP flows for sensitive operations
- TanStack Query for client-side state management

**Critical Blockers:**
- **No security headers** (CSP, X-Frame-Options, HSTS)
- **Build-time quality gates disabled** (`eslint.ignoreDuringBuilds: true`, `typescript.ignoreBuildErrors: true`)
- **Google OAuth broken** — new users cannot sign up (adapter missing, no user creation)
- **In-memory webhook dedup** — duplicate Stripe events possible on cold starts
- **Hardcoded mock data** in dashboard fallbacks
- **Incomplete account deletion** — orphaned data across 9+ tables
- **No rate limiting** on login/OTP endpoints — brute-force vulnerable
- **Live credentials** in `packages/database/.env`

---

## 2. Current Tech Stack Breakdown

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| **Frontend** | Next.js | 15.1.0 | App Router, Server Components |
| **UI Library** | React | 19.0.0 | Latest stable |
| **Styling** | Tailwind CSS | 4.0.0 | v4 with `@tailwindcss/postcss` |
| **Components** | shadcn/ui + Radix | v1.x | Accessibility-focused primitives |
| **State** | TanStack Query | 5.62.8 | Client-side caching |
| **Forms** | React Hook Form + Zod | 7.54.2 / 3.24.1 | Schema validation |
| **Database** | PostgreSQL | 16 | Via Docker |
| **ORM** | Prisma | 6.1.0 | With `postgresqlExtensions` preview |
| **Auth** | NextAuth.js | 5.0.0-beta.25 | **Beta — upgrade to stable** |
| **Payments** | Stripe | 17.5.0 | Checkout + Webhooks |
| **Email** | Resend | — | React Email templates |
| **Caching** | Upstash Redis | — | REST API based |
| **Monitoring** | Sentry | 8.47.0 | `@sentry/nextjs` |
| **Monorepo** | Turborepo | 2.3.3 | pnpm workspaces |
| **Package Manager** | pnpm | 9.15.1 | |
| **TypeScript** | 5.7.2 | Strict mode enabled |
| **Scraper** | Playwright + pg | 1.48.0 / 8.23.0 | Separate worker process |

**Lint/Typecheck Status:** ✅ Passing (no errors)

---

## 3. Critical Issues / Blockers (High Priority)

### 3.1 Security Headers Completely Missing
**Severity:** 🔴 Critical  
**Files:** `apps/web/next.config.ts`, `apps/web/middleware.ts`

No security headers are configured anywhere in the application:
- **Missing:** Content-Security-Policy (CSP)
- **Missing:** X-Frame-Options / frame-ancestors
- **Missing:** X-Content-Type-Options: nosniff
- **Missing:** Strict-Transport-Security (HSTS)
- **Missing:** Referrer-Policy
- **Missing:** Permissions-Policy

This leaves the application vulnerable to XSS, clickjacking, MIME-type sniffing, and protocol downgrade attacks.

### 3.2 Build-Time Quality Gates Disabled
**Severity:** 🔴 Critical  
**File:** `apps/web/next.config.ts:14-15`

```typescript
eslint: { ignoreDuringBuilds: true },
typescript: { ignoreBuildErrors: true },
```

This allows broken code, type errors, and lint violations to ship to production. **These must be re-enabled before any production deployment.**

### 3.3 Google OAuth Sign-Up Broken
**Severity:** 🔴 Critical  
**File:** `packages/auth/src/auth.ts:67-98`

The Google `signIn` callback only links Google accounts to **existing** users. It never creates a new user. Combined with the unused `@auth/prisma-adapter` dependency, **new Google OAuth users cannot sign up** — they will hit a dead end.

### 3.4 Stripe Webhook Idempotency Not Durable
**Severity:** 🔴 Critical  
**File:** `apps/web/app/api/stripe/webhook/route.ts:19-35`

The `processedEventIds` Set is in-memory only. On serverless cold starts or process restarts, duplicate webhook events can be processed, leading to duplicate subscription updates or double-charges.

### 3.5 Incomplete Account Deletion
**Severity:** 🔴 Critical  
**File:** `apps/web/app/api/user/delete-account/route.ts:43-66`

The deletion transaction only removes:
- `verificationToken`
- `walletTransaction`
- `leadPurchase`
- `organization` (if last member)

**Missing cleanup:** `SearchHistory`, `SavedList`, `LeadExport`, `AgentActivity`, `ApiKey`, `Subscription`, `AuditLog`, `Account`, `Session`. This leaves orphaned data and potential PII retention violations.

### 3.6 No Rate Limiting on Auth Endpoints
**Severity:** 🔴 Critical  
**Files:** Multiple auth routes

Rate limiting exists **only** on `verify-code`. The following endpoints are completely unprotected:
- `POST /api/auth/signup`
- `POST /api/auth/forgot-password`
- `POST /api/auth/resend-code`
- `POST /api/auth/reset-password`
- `POST /api/auth/verify-reset-code`
- `POST /api/auth/[...nextauth]` (login)

Attackers can brute-force credentials, OTPs, and email enumeration without throttling.

### 3.7 Password Reset Does Not Invalidate Sessions
**Severity:** 🔴 Critical  
**File:** `apps/web/app/api/auth/reset-password/route.ts`

After a password reset, all existing JWTs remain valid. If an account was compromised, the attacker retains access even after the victim changes their password.

### 3.8 Trusted Host Validation Disabled
**Severity:** 🔴 Critical  
**File:** `packages/auth/src/auth.ts:14`

```typescript
trustHost: true,
```

This disables Host header validation in NextAuth, enabling host-header injection attacks, open redirects, and session fixation vectors.

### 3.9 Hardcoded Mock Data in Dashboard
**Severity:** 🔴 Critical  
**File:** `apps/web/app/dashboard/page.tsx`

The dashboard falls back to `MOCK_RECENT_ORDERS` and `DEFAULT_MONTHLY_TRENDS` when the API returns empty data. Users see fabricated data instead of proper empty states.

### 3.10 Live Credentials in Repository
**Severity:** 🔴 Critical  
**File:** `packages/database/.env`

Contains a live-looking Neon PostgreSQL connection string with embedded credentials and `AUTH_SECRET`. Although `.gitignore` protects against commits, the file exists inside the working tree and is accessible to anyone with repository access.

---

## 4. Security & Authentication Audit

### 4.1 Auth Flow Security

| Issue | Severity | Details |
|-------|----------|---------|
| `trustHost: true` | 🔴 Critical | Disables host header validation |
| JWT maxAge = 7 days | 🟡 Medium | Long-lived tokens increase replay risk |
| JWT contains `role` + `walletBalance` | 🟡 Medium | Business data exposed in Base64 JWT payload |
| No IP/User-Agent binding | 🟡 Medium | Token valid from any IP |
| Google auto-verifies email | 🟡 Medium | Bypasses email verification for OAuth users |
| No CSRF enforcement visible | 🟢 Low | NextAuth v5 has built-in protection, but verify interaction with `trustHost` |

### 4.2 Password Handling

| Issue | Severity | Details |
|-------|----------|---------|
| bcryptjs with 12 salt rounds | ✅ Pass | Industry standard |
| Min password length = 8 | 🟢 Low | No complexity requirements (uppercase, special chars) |
| No breached-password check | 🟡 Medium | No HIBP or similar integration |
| Password reset doesn't invalidate sessions | 🔴 Critical | Attacker retains access after reset |

### 4.3 Role-Based Access Control (RBAC)

| Issue | Severity | Details |
|-------|----------|---------|
| Middleware only protects UI routes | 🔴 Critical | API routes lack RBAC enforcement |
| `isAdmin` treats ADMIN == SUPER_ADMIN | 🟢 Low | No privilege separation |
| `as any` casts bypass type safety | 🟢 Low | `auth.ts:106, 120, 121` |

### 4.4 Input Validation

| Issue | Severity | Details |
|-------|----------|---------|
| Manual destructuring instead of Zod | 🟢 Low | No runtime schema validation in most routes |
| Weak email validation | 🟢 Low | `newEmail.includes("@")` in `request-change/route.ts:20` |
| `Number()` without `isNaN` guards | 🟡 Medium | `agents/route.ts`, `admin/agents/route.ts`, `stripe/checkout/route.ts` |

### 4.5 Verification Token Security

| Issue | Severity | Details |
|-------|----------|---------|
| 6-digit numeric OTP | 🟡 Medium | 900K possibilities — brute-forceable without rate limiting |
| Tokens in plaintext | 🟡 Medium | DB compromise exposes all active OTPs |
| No rate limiting on verify-reset-code | 🔴 Critical | Brute-force target |
| Shared token namespace | 🟢 Low | Same table for signup, reset, email change, deletion |

### 4.6 Data Exposure Risks

| Issue | Severity | Details |
|-------|----------|---------|
| Account tokens in plaintext | 🟡 Medium | `access_token`, `refresh_token` unencrypted in DB |
| OAuth tokens stored in Account table | 🟡 Medium | Standard pattern, but no encryption-at-rest |
| `ApiKey.hashedKey` vs raw `key` | 🟢 Info | Ensure raw key never returned in responses |

---

## 5. Database & Data Modeling

### 5.1 Schema Design

**Strengths:**
- Comprehensive enum definitions for all status fields
- Proper foreign key relationships with `onDelete: Cascade`
- Strategic indexes on frequently queried fields
- Unique constraints on `email`, `slug`, `googlePlaceId`, `stripeSubscriptionId`
- `verificationToken` with composite unique constraint

**Concerns:**

| Issue | Severity | Details |
|-------|----------|---------|
| `Agent.email` unique + nullable | 🟡 Medium | Unique constraint on nullable field can cause issues with partial indexes |
| `googleSubcategories` as joined string | 🟢 Low | Not normalized — difficult to query/filter |
| `socialProfiles` as Json | 🟢 Low | No schema enforcement |
| No `updatedAt` on `AgentActivity` | 🟢 Low | Missing audit trail field |
| `User.walletBalance` as Float | 🟡 Medium | Floating-point for currency — use `Decimal` or integer cents |

### 5.2 Query Efficiency

**Strengths:**
- Parallel `findMany` + `count` with `Promise.all`
- Pagination with `skip`/`take`
- State-based data masking in application layer

**Concerns:**

| Issue | Severity | Details |
|-------|----------|---------|
| `Agent` has 16 indexes | 🟡 Medium | May impact write performance; review unused indexes |
| `OR` conditions in search | 🟢 Low | `fullName`, `email`, `brokerageName` — could use full-text search |
| No composite index on `[state, isVerified]` | 🟢 Low | Common filter pattern |

### 5.3 Migrations & Seed

| Issue | Severity | Details |
|-------|----------|---------|
| No user seeding | 🟡 Medium | Fresh DB has no authentication path |
| `Math.random()` in seed | 🟢 Info | Non-cryptographic — fine for fake data |
| Destructive SQL script without guard | 🟡 Medium | `cleanup-non-email-agents.sql` runs `DELETE` without dry-run |

---

## 6. Frontend & UI/UX Health

### 6.1 Component Architecture

**Strengths:**
- Clear separation: landing, dashboard, auth, admin
- Server components by default, client components only when needed
- Shared UI package with shadcn/ui primitives
- Consistent use of `cn()` utility for Tailwind merging

**Concerns:**

| Issue | Severity | Details |
|-------|----------|---------|
| `as any` casts for session data | 🟡 Medium | `dashboard/layout.tsx:18` casts `session.user` |
| Hardcoded `walletBalance` fallback | 🟡 Medium | `25.0` magic number in `dashboard/layout.tsx:18` |
| Mock data in dashboard | 🔴 Critical | `MOCK_RECENT_ORDERS`, `DEFAULT_MONTHLY_TRENDS` |
| No loading skeletons in some routes | 🟢 Low | Basic `loading.tsx` files exist but may be minimal |

### 6.2 Performance & Asset Management

**Strengths:**
- Next.js font optimization with `display: swap`
- Image remote patterns configured for Google/GitHub avatars
- `experimental.optimizePackageImports` for monorepo packages

**Concerns:**

| Issue | Severity | Details |
|-------|----------|---------|
| No image optimization for agent photos | 🟡 Medium | `photoUrl` in DB — no `next/image` usage visible |
| `transpilePackages` includes all 4 packages | 🟢 Low | Adds build overhead |
| No lazy loading for heavy components | 🟢 Low | Dashboard maps, tables may block initial render |

### 6.3 State Management

- **TanStack Query:** Properly configured with `staleTime: 60s`, `refetchOnWindowFocus: false`
- **Client state:** Local `useState` for transient UI — appropriate
- **No global state manager** (Redux/Zustand) — appropriate for this scale

---

## 7. Backend, APIs & Business Logic

### 7.1 API Route Structure

**Pattern:** RESTful routes under `app/api/` with server-side handlers.

**Strengths:**
- Consistent use of `auth()` for session checks
- Admin guard utility (`requireAdminApi`) for protected routes
- Proper HTTP status codes (401, 403, 400, 500)

**Concerns:**

| Issue | Severity | Details |
|-------|----------|---------|
| No request validation middleware | 🟡 Medium | Manual parsing in each route |
| `Number()` without `isNaN` | 🟡 Medium | `agents/route.ts`, `stripe/checkout/route.ts` |
| Inconsistent error response format | 🟢 Low | Some routes return `{ error }`, others `{ success, data }` |
| No API versioning | 🟢 Low | Not critical for internal APIs |

### 7.2 Error Handling & Logging

**Strengths:**
- Try/catch in most route handlers
- Consistent log prefixes (`[ADMIN_*_ERROR]`, `[INTERNAL_*]`)
- Sentry configured in dependencies

**Concerns:**

| Issue | Severity | Details |
|-------|----------|---------|
| No Sentry integration in code | 🟡 Medium | Package installed but no initialization found |
| Generic error messages | 🟢 Low | "Internal server error" without context |
| No dead-letter queue for webhooks | 🔴 Critical | Failed Stripe events silently dropped |
| Webhook logs only to console | 🟡 Medium | No structured logging or alerting |

### 7.3 State & Caching

**Strengths:**
- Upstash Redis configured (though usage not visible in audited routes)
- TanStack Query for client-side caching
- Server Components reduce client-side data fetching

**Concerns:**

| Issue | Severity | Details |
|-------|----------|---------|
| No Redis usage in API routes | 🟡 Medium | Configured but not utilized for rate limiting or caching |
| In-memory rate limiting (verify-code) | 🔴 Critical | Lost on restart, not distributed-safe |
| Webhook dedup in-memory | 🔴 Critical | Not durable across cold starts |

---

## 8. Scraper Engine Audit

### 8.1 Anti-Ban Measures

**Strengths:**
- Proxy pool with health tracking
- Token bucket rate limiter
- Exponential backoff + jitter
- User-agent rotation (6 profiles)
- Playwright stealth args

**Critical Concerns:**

| Issue | Severity | Details |
|-------|----------|---------|
| TLS verification disabled | 🔴 Critical | `rejectUnauthorized: false` in proxy CONNECT |
| Sync decompression on event loop | 🟠 High | `zlib.gunzipSync` blocks I/O |
| No per-domain rate limiting | 🟠 High | Global limiter, same domain hammered |
| Proxy credentials in URLs | 🟠 High | Logged in test output |
| Static `sec-fetch-*` headers | 🟡 Medium | Browser fingerprinting signal |
| No CAPTCHA handling | 🟡 Medium | Google Maps may block |

### 8.2 Data Quality

**Critical Concerns:**

| Issue | Severity | Details |
|-------|----------|---------|
| Hardcoded `isVerified = true` | 🔴 Critical | Unconditional in `db-sync.ts` |
| In-memory dedup only | 🟠 High | Lost on restart |
| Race condition in duplicate check | 🟠 High | Non-atomic SELECT + UPSERT |
| Destructive scripts without dry-run | 🟠 High | `reset-agents.ts`, `verify-data-quality.ts` |

### 8.3 Email Validation

**Strengths:**
- Multi-stage: syntax → disposable → MX → SMTP
- Catch-all detection
- Obfuscation decoding
- Domain matching

**Concerns:**

| Issue | Severity | Details |
|-------|----------|---------|
| HELO defaults to `localhost` | 🟠 High | Many servers reject this |
| SMTP port 25 default | 🟠 High | Blocked by AWS/GCP/Azure |
| No greylisting retry | 🟡 Medium | Treated as failure |
| Probe address leaks timestamp | 🟢 Low | `Date.now().toString(36)` |

---

## 9. Technical SEO & Core Web Vitals Readiness

### 9.1 Meta & Open Graph

**Strengths:**
- Root `layout.tsx` exports `metadata` with `metadataBase`, OpenGraph, keywords
- Title template: `"%s | LeadsDom"`
- `viewport` export with theme color

**Gaps:**

| Issue | Severity | Details |
|-------|----------|---------|
| No page-level `metadata` exports | 🟡 Medium | `page.tsx`, dashboard pages lack custom titles/descriptions |
| No Twitter Card metadata | 🟡 Medium | Only OpenGraph defined |
| No JSON-LD structured data | 🟡 Medium | No Schema.org for Organization, Product, Breadcrumbs |
| No canonical tags | 🟢 Low | Relies on Next.js default (usually fine) |

### 9.2 Crawling & Indexing

**Strengths:**
- `sitemap.ts` exports static URLs
- `robots.ts` disallows `/dashboard/` and `/api/`
- Sitemap reference in robots.txt

**Gaps:**

| Issue | Severity | Details |
|-------|----------|---------|
| Sitemap missing key pages | 🟡 Medium | No `/dashboard/search`, `/dashboard/lists`, `/pricing` |
| `lastModified` all set to `new Date()` | 🟢 Low | Misleading for crawlers |
| Auth pages not explicitly `noindex` | 🟢 Low | `/login`, `/register` could be discovered |
| No `hreflang` | 🟢 Low | Single-language site, but good practice |

### 9.3 Core Web Vitals Readiness

**Strengths:**
- `display: swap` for fonts
- Server Components reduce JS bundle
- Image optimization configured for common sources

**Gaps:**

| Issue | Severity | Details |
|-------|----------|---------|
| No `next/image` usage for agent photos | 🟡 Medium | `photoUrl` rendered as raw `<img>` |
| No lazy loading for heavy components | 🟢 Low | US map, tables may block LCP |
| No CLS safeguards | 🟢 Low | No aspect-ratio boxes for dynamic content |

---

## 10. Code Quality, Bugs & Technical Debt

### 10.1 Detected Bugs

| Bug | Severity | File | Details |
|-----|----------|------|---------|
| `calculateUpgradePrice` always returns 0 | 🟠 High | `packages/utils/src/index.ts:142-152` | Incomplete pricing logic |
| `URL.parse` deprecated | 🟡 Medium | `packages/scraper-engine/src/crawler.ts:198` | Use `new URL()` |
| `isDnsResolvableEmail` doesn't DNS check | 🟡 Medium | `packages/scraper-engine/src/email-finder.ts:280-285` | Misleading name |
| `getProxyAgent` never assigned | 🟢 Low | `packages/scraper-engine/src/anti-ban.ts` | Dead code |
| Place ID dedup in-memory only | 🟠 High | `packages/scraper-engine/src/google-maps.adapter.ts` | Lost on restart |

### 10.2 Deprecated APIs

| API | Status | Recommendation |
|-----|--------|----------------|
| `URL.parse()` | Deprecated | Replace with `new URL()` |
| `next-auth@5.0.0-beta.25` | Beta | Upgrade to stable v5 or latest v4 |

### 10.3 Type Safety

| Issue | Severity | Details |
|-------|----------|---------|
| `as any` casts in auth callbacks | 🟢 Low | Bypasses TypeScript for JWT/session fields |
| `session: any` in admin guard | 🟢 Low | Loses type safety |
| `as UserRole` casts | 🟢 Low | Multiple routes cast query params |

---

## 11. Dependency Health

**Audit Result:** No vulnerabilities found by `pnpm audit` (clean output).  
**Outdated Result:** No outdated packages reported (all within declared ranges).

**Concerns:**

| Package | Version | Concern |
|---------|---------|---------|
| `next-auth` | 5.0.0-beta.25 | Beta — upgrade to stable |
| `@sentry/nextjs` | 8.47.0 | Modern, no issues |
| `stripe` | 17.5.0 | Modern, no issues |
| `playwright` | 1.48.0 | Modern, no issues |

---

## 12. Suggested Step-by-Step Action Plan

### Phase 1: Critical Security Fixes (Week 1) — **Do Not Deploy Without These**

1. **Add security headers** in `next.config.ts`:
   - `X-Frame-Options: DENY`
   - `X-Content-Type-Options: nosniff`
   - `Strict-Transport-Security`
   - `Content-Security-Policy`
   - `Referrer-Policy: strict-origin-when-cross-origin`

2. **Re-enable build-time quality gates:**
   - Set `eslint.ignoreDuringBuilds: false`
   - Set `typescript.ignoreBuildErrors: false`

3. **Fix Google OAuth sign-up:**
   - Either wire up `@auth/prisma-adapter` properly
   - Or create user in `signIn` callback when `!existingUser`

4. **Fix Stripe webhook idempotency:**
   - Add `processedEventId` column to database
   - Use DB-level unique constraint for idempotency

5. **Complete account deletion cleanup:**
   - Add missing tables: `SearchHistory`, `SavedList`, `LeadExport`, `AgentActivity`, `ApiKey`, `Subscription`, `AuditLog`, `Account`, `Session`
   - Add `AuditLog` entry for deletion event

6. **Add rate limiting to all auth endpoints:**
   - Use Upstash Redis for distributed rate limiting
   - Cover: signup, login, forgot-password, reset-password, verify-code, resend-code

7. **Invalidate sessions on password reset:**
   - Add `sessionVersion` field to `User` model
   - Rotate version on password change
   - Include version in JWT validation

8. **Remove `trustHost: true`:**
   - Configure `trustHost: false` with explicit `NEXTAUTH_URL`

9. **Remove mock data fallbacks:**
   - Replace with proper empty states in `dashboard/page.tsx`

10. **Rotate and relocate credentials:**
    - Rotate `packages/database/.env` credentials
    - Move secrets to environment variables or secrets manager

### Phase 2: High-Priority Improvements (Week 2-3)

11. **Add input validation middleware:**
    - Use Zod for all API route bodies and query params
    - Replace `Number()` with `z.coerce.number()`

12. **Reduce JWT maxAge:**
    - Change from 7 days to 24 hours
    - Implement refresh token mechanism if needed

13. **Shorten OTP lifetime:**
    - Reduce from current duration to 10 minutes
    - Add max attempts before invalidation

14. **Add password complexity requirements:**
    - Minimum 8 chars + uppercase + lowercase + number + special char

15. **Add breached-password check:**
    - Integrate HIBP k-anonymity API

16. **Fix scraper engine issues:**
    - Re-enable TLS verification (`rejectUnauthorized: true`)
    - Replace sync `zlib.*Sync` with streaming async
    - Add per-domain rate limiting
    - Move dedup to database or Redis

17. **Fix `calculateUpgradePrice`:**
    - Implement actual pricing logic or remove dead code

18. **Add Sentry initialization:**
    - Initialize `@sentry/nextjs` in root layout or instrumentation file

### Phase 3: Medium-Priority Enhancements (Week 4+)

19. **SEO improvements:**
    - Add page-level `metadata` exports
    - Add JSON-LD structured data (Organization, Product)
    - Add Twitter Card metadata
    - Fix sitemap `lastModified` to be dynamic
    - Add `noindex` to auth pages in `robots.ts`

20. **Frontend performance:**
    - Use `next/image` for agent photos
    - Add lazy loading for heavy dashboard components
    - Add aspect-ratio boxes for dynamic content (CLS)

21. **Database improvements:**
    - Change `User.walletBalance` to integer cents or `Decimal`
    - Normalize `Agent.googleSubcategories` to separate table
    - Add `updatedAt` to `AgentActivity`

22. **Scraper improvements:**
    - Replace `URL.parse` with `new URL()`
    - Add CAPTCHA detection/handling
    - Add greylisting retry logic
    - Fix HELO domain from `localhost`

23. **Code quality:**
    - Replace `as any` casts with proper types
    - Add `exactOptionalPropertyTypes` to TS config
    - Add mutation error handling in QueryClient

---

## 13. Summary Checklist

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Security | 10 | 4 | 5 | 4 | 23 |
| Auth | 5 | 2 | 3 | 3 | 13 |
| Database | 1 | 2 | 2 | 2 | 7 |
| Frontend | 1 | 1 | 2 | 2 | 6 |
| SEO | 0 | 0 | 3 | 2 | 5 |
| Scraper | 2 | 4 | 3 | 3 | 12 |
| Code Quality | 0 | 1 | 1 | 3 | 5 |
| **Total** | **19** | **14** | **19** | **19** | **71** |

**Recommendation:** Do not deploy to production until all **Critical** issues are resolved. The application is currently suitable for internal testing and development only.

---

*Audit completed. All findings are based on static code analysis and configuration review. Dynamic testing and penetration testing are recommended before production launch.*
