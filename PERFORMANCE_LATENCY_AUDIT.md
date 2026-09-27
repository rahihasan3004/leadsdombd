# LeadsDom — Performance & Latency Audit Report

**Date:** 2026-09-27  
**Stack:** Next.js 15 (App Router) · React 19 · Prisma · Neon PostgreSQL (ap-southeast-1) · Upstash Redis (env only) · Vercel deployment  
**Scope:** Page load architecture, database latency, caching gaps, and actionable speed optimizations.

---

## 1. Page Load Architecture & TTFB

| Route | Rendering Mode | Data Fetching | Estimated TTFB (warm) | Estimated TTFB (cold) |
|---|---|---|---|---|
| `/` (Landing) | CSR (static components, no SSR) | None | ~50–100 ms | ~50–100 ms |
| `/dashboard` | **RSC** (Server Component) | `auth()` + `getDashboardMetrics()` (5+ DB queries) | ~250–450 ms | ~600–1,200 ms |
| `/dashboard/search` | CSR (`"use client"`) | `useEffect` → `/api/leads/stats` | ~150–250 ms | ~400–700 ms |
| `/dashboard/lists` | CSR (`"use client"`) | `useEffect` → `/api/purchases` (+ optional `/api/purchases?purchaseId=`) | ~200–350 ms | ~500–900 ms |
| `/dashboard/billing` | CSR (`"use client"`) | `useEffect` → `Promise.all([/api/billing/transactions, /api/user/profile])` | ~180–300 ms | ~450–800 ms |

### Key Observations

- **Landing page (`/`)** is purely client-rendered static markup. TTFB is minimal, but there is no SSR/SSG benefit from Next.js for this route.
- **Dashboard (`/dashboard`)** is a Server Component that performs authenticated DB queries on every request. This is the slowest route because:
  - It calls `auth()` (JWT verification + potential DB lookup for token version).
  - `getDashboardMetrics()` executes **5 sequential/parallel DB queries** (user, unlockedLead count×2, leadPurchase count, leadPurchase findMany).
  - It then runs a second `unlockedLead.findMany` for monthly trend bucketing.
- **Order Engine (`/dashboard/search`)** is a client component. It hydrates the entire search UI and fetches inventory stats via `fetch("/api/leads/stats")` inside `useEffect`. This adds a client-side waterfall after hydration.
- **Leads Vault (`/dashboard/lists`)** is fully client-side. On mount it fetches all purchases. When a purchase is selected, it fetches all unlocked leads with full agent `include` — this can return thousands of rows and cause a noticeable stall.
- **Billing (`/dashboard/billing`)** is client-side and fetches transactions + profile in parallel, which is good, but both endpoints hit the database directly.

---

## 2. Database Query Latency & Neon Connection Overhead

### Prisma Client Configuration

**File:** `packages/database/src/index.ts`
```ts
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
```

**File:** `.env.local`
```env
DATABASE_URL="postgresql://...@ep-cold-dream-b3bmw4wh-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connection_limit=10&pool_timeout=20"
DIRECT_URL="postgresql://...@ep-cold-dream-b3bmw4wh.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connection_limit=10&pool_timeout=20"
```

### Connection Strategy

- **Pooling:** Neon's **HTTP-based connection pooler** (`-pooler.` subdomain) is correctly used for `DATABASE_URL`. This is effectively PgBouncer-style pooling managed by Neon.
- **Direct connection:** `DIRECT_URL` points to the non-pooler endpoint. This is typically reserved for Prisma migrations (`db:push`, `db:migrate`) and long-running scripts. **Good practice.**
- **Pool settings:** `connection_limit=10&pool_timeout=20`. For a serverless workload on Vercel, this is reasonable but on the lower side. If multiple dashboard requests hit cold functions simultaneously, the pool can saturate.
- **No explicit `pgbouncer` config in Prisma schema:** Prisma relies on the URL params. This is standard for Neon.

### Estimated Query Latency (Singapore → Vercel)

| Scenario | Estimated DB Query Time |
|---|---|
| **Warm pooler connection** (same region or low-latency Vercel region) | 10–30 ms per simple `findUnique` / `count` |
| **Cold pooler connection** (serverless function cold start + new pooler connection) | 200–500 ms first query, then 10–30 ms subsequent |
| **Cross-region Vercel** (e.g., Vercel Edge in `iad1` or `sfo1` → Neon `ap-southeast-1`) | 150–300 ms RTT + 10–30 ms query = **180–330 ms per query** |

### Query Parallelization

**Good patterns found:**
- `app/api/agents/route.ts:96` — `Promise.all([db.agent.findMany(...), db.agent.count(...)])`
- `app/api/dashboard/metrics/route.ts:39-57` — `Promise.all` for purchases, deliverable count, total count, delivered files count.
- `app/api/admin/inventory/states/route.ts:37-70` — `Promise.all` for 5 groupBy/findMany queries.

**Sequential waterfalls / slow patterns:**
- `app/dashboard/page.tsx:65-71` — After the initial `Promise.all`, a second `db.unlockedLead.findMany` runs **sequentially** for monthly trends.
- `app/api/purchases/route.ts:36-43` — Sequential `findMany` for existing purchases, then `flatMap`, then `count`. Should be parallelized.
- `app/api/billing/route.ts:36-65` — Sequential `findMany` for wallet transactions and lead purchases. These are independent and should run in parallel.
- `app/api/leads/stats/route.ts:25-35` — Single `db.agent.groupBy` on the entire `Agent` table. On a large dataset (2M+ rows), this can take 300–800 ms without an index on `(state, isDeliverable, email)`.

---

## 3. Caching Strategy (Upstash Redis / Next.js Data Cache)

### Redis Usage

**Environment variables exist:**
- `.env.example` and `.env.local` declare `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

**Actual code usage:** **ZERO.**
- There is no `import Redis from "@upstash/redis"` anywhere in the codebase.
- There is no `new Redis(...)` instantiation.
- **Redis is configured in env but completely unused for application caching or rate-limiting.**

### Next.js Data Cache (`unstable_cache`)

**Usage:** **NONE.**
- No `import { unstable_cache } from "next/cache"` found anywhere.
- No `cacheLife` or `cacheTag` configuration found.
- No `next: { tags: [...] }` or `updateTag` usage in Server Components or Route Handlers.

### Existing Ad-hoc Caching

Only **one** instance of manual caching exists:

**File:** `app/api/leads/stats/route.ts:6-9`
```ts
const TTL_MS = 60_000;
let cachedData: Record<string, number> | null = null;
let cachedAt = 0;
```

**Caveats:**
- This is **in-memory, per-serverless-instance caching**.
- On Vercel, serverless functions are ephemeral and scale to zero. Each new instance will have `cachedData = null`.
- The 60-second TTL is short and does not survive function cold starts.
- It does **not** help with dashboard metrics, inventory stats, or billing data.

### What Should Be Cached

| Data | Current State | Should Be Cached? | Why |
|---|---|---|---|
| State inventory stats (`/api/leads/stats`) | 60s in-memory TTL | **Yes — Redis or `unstable_cache`** | `groupBy` on 2M+ agents is expensive. |
| Admin inventory states (`/api/admin/inventory/states`) | None | **Yes — Redis** | 5 `groupBy` queries on large tables. |
| Dashboard metrics (`/api/dashboard/metrics`) | None | **Yes — `unstable_cache` (per-user)** | Metrics are computed on every page load. |
| Agent search counts | None | **Yes — `unstable_cache`** | `/api/agents` `count` queries. |
| Pricing / state pack data | None | **Yes — `unstable_cache` or Redis** | Static-ish data that changes rarely. |

---

## 4. Bottlenecks & Speed Optimization Recommendations

### Identified Bottlenecks

1. **Dashboard Metrics Waterfall** (`app/dashboard/page.tsx`)
   - `getDashboardMetrics` runs an initial `Promise.all` (good), but then runs a **second sequential `findMany`** for monthly trends. This adds ~20–50 ms to every dashboard load.

2. **Unbounded Payloads in `/api/purchases`** (`app/api/purchases/route.ts:216-268`)
   - When `purchaseId` is provided, it fetches `unlockedLeads` with a full `agent` `include`. If a user unlocks 5,000 leads across 5 states, this returns **all 5,000 agents with ~35 fields each** in a single JSON payload. This can take 500+ ms to serialize and transmit.

3. **No Caching on Expensive Aggregations** (`app/api/leads/stats/route.ts`, `app/api/admin/inventory/states/route.ts`)
   - `groupBy` on the `Agent` table without caching means these endpoints recompute on every hit.

4. **Client-Side Data Fetching on Protected Routes** (`app/dashboard/lists/page.tsx`, `app/dashboard/billing/page.tsx`)
   - These are `"use client"` pages that fetch data in `useEffect`. This means:
     - The HTML shell renders first (fast).
     - A second round-trip is required for data.
     - SEO is irrelevant here, but **perceived performance** is worse than RSC streaming.

5. **Auth JWT Callback DB Hits** (`packages/auth/src/auth.ts:176-214`)
   - On every session check, if `user` is present, it queries `db.user.findUnique` to get `role`, `walletBalance`, and `tokenVersion`.
   - On every client-side navigation, NextAuth's `useSession` may trigger a session callback that hits the DB. This adds 10–30 ms per auth check.

### 2–3 Quick Actionable Tips to Hit <200–300 ms

#### Tip 1: Cache Dashboard Metrics with `unstable_cache` (Target: 50–100 ms)

Move `getDashboardMetrics` logic into a **cached Server Action or Route Handler** using Next.js `unstable_cache`. Cache per-user for 30–60 seconds.

**Example approach:**
```ts
// app/api/dashboard/metrics/route.ts
import { unstable_cache } from "next/cache";

const getCachedMetrics = unstable_cache(
  async (userId: string) => {
    // existing getDashboardMetrics logic
  },
  ["dashboard-metrics"],
  { tags: ["dashboard", userId], revalidate: 30 }
);

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const metrics = await getCachedMetrics(session.user.id);
  return NextResponse.json(metrics);
}
```
**Impact:** Eliminates repeated DB aggregation on every dashboard visit. Reduces dashboard TTFB from ~300–450 ms to **~50–150 ms** on cache hit.

#### Tip 2: Cache `/api/leads/stats` in Redis (Target: 5–10 ms)

Replace the in-memory TTL cache with **Upstash Redis** (which is already env-configured but unused).

```ts
import { Redis } from "@upstash/redis";
const redis = Redis.fromEnv();

export async function GET() {
  const cached = await redis.get<Record<string, number>>("leads:stats");
  if (cached) return NextResponse.json(cached);

  // ... run db.agent.groupBy ...
  await redis.set("leads:stats", counts, { ex: 60 });
  return NextResponse.json(counts);
}
```
**Impact:** `/api/leads/stats` drops from 300–800 ms to **5–10 ms** after the first request. This directly speeds up the Order Engine (`/dashboard/search`) load.

#### Tip 3: Parallelize and Paginate `/api/purchases` (Target: 100–200 ms)

- **Parallelize:** In `GET` (non-purchaseId path), run `db.leadPurchase.findMany` and `db.leadPurchase.count` in parallel with `Promise.all`.
- **Paginate leads:** When `purchaseId` is provided, do NOT return all unlocked leads. Add `limit`/`page` params and return paginated data. This prevents 500+ ms serialization stalls for large orders.
- **Lazy-load agent details:** Return only essential lead fields (name, email, phone, state, brokerage) in list views. Full details should load on click via `/api/agents/[id]`.

**Impact:** `/dashboard/lists` initial load drops from ~200–350 ms to **~100–150 ms**. Expanding an order drops from ~500–900 ms to **~100–200 ms**.

---

## Summary

| Area | Current State | After Quick Fixes |
|---|---|---|
| **Dashboard TTFB** | 250–450 ms | 50–150 ms (cached) |
| **Order Engine TTFB** | 150–250 ms + 300–800 ms stats | 150–250 ms + 5–10 ms stats (Redis) |
| **Leads Vault initial load** | 200–350 ms | 100–150 ms (parallelized) |
| **Leads Vault order expand** | 500–900 ms | 100–200 ms (paginated) |
| **Billing TTFB** | 180–300 ms | 150–250 ms (cached metrics) |
| **Redis utilization** | 0% (env only) | Active caching for stats & metrics |
| **Next.js Data Cache** | 0% | `unstable_cache` on dashboard & pricing |

**Biggest win:** Implement Redis caching for state inventory stats and `unstable_cache` for per-user dashboard metrics. These two changes alone will make the two slowest routes (Dashboard and Order Engine) feel instant.
