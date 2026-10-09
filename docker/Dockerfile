# Production image for apps/web (Next.js standalone output).
# Build from the repo root:  docker build -f docker/Dockerfile .
#
# Lightweight by design: no Playwright/browsers, no scraper worker. Lead data is
# ingested externally (Lobstr API), so only the web app and its workspace deps
# are installed and built.
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1
ENV TURBO_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable pnpm

FROM base AS builder
WORKDIR /app
# Safety net in case any transitive dep pulls in Playwright.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY packages ./packages
COPY apps ./apps

# Install only the web app, its workspace dependencies, and the root (turbo).
# This skips @fine-leads/scraper-engine (playwright, pg, tsx) entirely.
RUN pnpm install --frozen-lockfile --filter "@fine-leads/web..." --filter fine-leads

# NEXT_PUBLIC_* values are inlined into the client bundle at build time.
ARG NEXT_PUBLIC_APP_URL=""
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV BUILD_STANDALONE=1

RUN pnpm --filter @fine-leads/database db:generate
RUN pnpm turbo build --filter=@fine-leads/web

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs

# Monorepo standalone output keeps the workspace layout: server.js lives in apps/web/.
# static/ and public/ are not part of the trace and must be copied next to server.js.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
