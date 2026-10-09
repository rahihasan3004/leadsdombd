# Fine Leads (LeadsDom) - System Status & Notes

This document is a safe, inert documentation file containing the current state of the platform for internal reference. It has no effect on runtime code execution or builds.

---

## 🛠️ Stack & Infrastructure
- **Framework:** Next.js 15 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS v4, Radix UI / shadcn
- **Database:** Prisma 6 with Neon Serverless PostgreSQL (`-pooler` enabled)
- **Cache & Rate Limiting:** Upstash Redis
- **Auth:** NextAuth v5 + bcryptjs + OTP verification
- **Payments:** Lemon Squeezy (Hardened webhooks & server-side pricing)
- **Emails:** Resend API

---

## 🚀 Key Improvements & Completed Tasks
1. **Payments & Security:** Server-side pricing enforcement, webhook HMAC signature validation, and duplicate/refund handling.
2. **Race Conditions:** Atomic credit deduction inside Prisma transactions (zero double-spend risk).
3. **Responsive Design:** 100% mobile-friendly across 320px to 4K displays (P0-P3 implemented).
4. **Backend Performance:** 
   - Eliminated the 50-request sequential waterfall in Leads Vault.
   - Replaced multi-step database loops with unified PostgreSQL aggregation queries.
   - Upstash Redis caching with 60s TTL for heavy inventory stats.
5. **UI & Usability:** Smart ellipsis pagination (`...`) with compact single-row controls on mobile.
6. **Tests:** Full test suite running with 99 passing Vitest unit/regression tests.

---

## 📌 Maintenance Commands
- **Run Tests:** `pnpm test`
- **Typecheck:** `pnpm typecheck`
- **Lint:** `pnpm lint`
- **Deploy Migrations:** `pnpm db:migrate:deploy`