import { LeadPipeline, type PipelineStats } from "./pipeline.js";
import { DatabaseSynchronizer } from "./db-sync.js";
import type { SourceAdapter, DiscoveryQuery, LocationSpec } from "./crawler.js";
import { getEnv } from "./config/env.js";

export interface RunnerConfig {
  sourceAdapter: SourceAdapter;
  niches: string[];
  states: string[];
  cities?: string[];
  cityBatchDelayMs?: number;
  jitterMs?: number;
  maxBatches?: number;
}

const DEFAULT_CITY_BATCH_DELAY_MS = 5000;
const DEFAULT_JITTER_MS = 3000;

interface AccumStats {
  totalScraped: number;
  websitesCrawled: number;
  emailsFound: number;
  emailsValidated: number;
  duplicatesSkipped: number;
  leadsSavedToDb: number;
  errorsEncountered: number;
  startTime: number;
}

function emptyAccum(): AccumStats {
  return {
    totalScraped: 0,
    websitesCrawled: 0,
    emailsFound: 0,
    emailsValidated: 0,
    duplicatesSkipped: 0,
    leadsSavedToDb: 0,
    errorsEncountered: 0,
    startTime: Date.now(),
  };
}

function mergeAccum(acc: AccumStats, batch: PipelineStats): void {
  acc.totalScraped += batch.totalScraped;
  acc.websitesCrawled += batch.websitesCrawled;
  acc.emailsFound += batch.emailsFound;
  acc.emailsValidated += batch.emailsValidated;
  acc.duplicatesSkipped += batch.duplicatesSkipped;
  acc.leadsSavedToDb += batch.leadsSavedToDb;
  acc.errorsEncountered += batch.errorsEncountered;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildQueries(config: RunnerConfig): DiscoveryQuery[] {
  const queries: DiscoveryQuery[] = [];
  const cities = config.cities && config.cities.length > 0 ? config.cities : undefined;

  for (const niche of config.niches) {
    for (const state of config.states) {
      if (cities) {
        const locations: LocationSpec[] = cities.map((city) => ({
          state: state.toUpperCase(),
          city,
        }));
        queries.push({ category: niche, locations });
      } else {
        queries.push({
          category: niche,
          locations: [{ state: state.toUpperCase() }],
        });
      }
    }
  }

  return queries;
}

function logBatch(batch: PipelineStats, total: AccumStats, num: number): void {
  console.log(
    `[runner] Batch ${num} done in ${(batch.totalRunTimeMs / 1000).toFixed(1)}s | ` +
      `scraped=${batch.totalScraped} emails=${batch.emailsFound} ` +
      `validated=${batch.emailsValidated} saved=${batch.leadsSavedToDb} ` +
      `skipped=${batch.duplicatesSkipped} errors=${batch.errorsEncountered}`,
  );
}

function logSummary(stats: AccumStats, totalBatches: number): void {
  const totalMs = Date.now() - stats.startTime;
  const mins = (totalMs / 60000).toFixed(1);
  console.log("\n=== Runner Summary ===");
  console.log(`Total batches:     ${totalBatches}`);
  console.log(`Total run time:    ${mins} minutes`);
  console.log(`Total scraped:     ${stats.totalScraped}`);
  console.log(`Websites crawled:  ${stats.websitesCrawled}`);
  console.log(`Emails found:      ${stats.emailsFound}`);
  console.log(`Emails validated:  ${stats.emailsValidated}`);
  console.log(`Leads saved to DB: ${stats.leadsSavedToDb}`);
  console.log(`Duplicates skipped:${stats.duplicatesSkipped}`);
  console.log(`Errors:            ${stats.errorsEncountered}`);
  console.log("======================");
}

export async function runContinuous(config: RunnerConfig): Promise<void> {
  const env = getEnv();
  const pipeline = new LeadPipeline();
  const dbSync = new DatabaseSynchronizer();

  const delayMs = config.cityBatchDelayMs ?? DEFAULT_CITY_BATCH_DELAY_MS;
  const jitterMs = config.jitterMs ?? DEFAULT_JITTER_MS;
  const maxBatches = config.maxBatches ?? Infinity;

  let running = true;
  let batchCount = 0;
  const totals = emptyAccum();

  const shutdown = (signal: string) => {
    console.log(`\n[runner] Received ${signal}. Shutting down gracefully...`);
    running = false;
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  console.log("[runner] Checking database connectivity...");
  const healthy = await dbSync.healthCheck();
  if (!healthy) {
    console.error("[runner] Database health check failed. Exiting.");
    await dbSync.close();
    process.exit(1);
  }
  console.log("[runner] Database connection OK. Starting continuous operation.");

  const queries = buildQueries(config);
  if (queries.length === 0) {
    console.error("[runner] No queries generated. Check niches and states configuration.");
    await dbSync.close();
    process.exit(1);
  }

  console.log(
    `[runner] Loaded ${queries.length} query combinations across ` +
      `${config.niches.length} niches × ${config.states.length} states.`,
  );

  let queryIndex = 0;

  while (running && batchCount < maxBatches) {
    const query = queries[queryIndex % queries.length]!;
    batchCount++;
    queryIndex++;

    const loc = query.locations[0]!;
    const locLabel = loc.city
      ? `${loc.city}, ${loc.state}`
      : loc.state;

    console.log(
      `[runner] Batch ${batchCount}: "${query.category}" @ ${locLabel}`,
    );

    try {
      const batchStats = await pipeline.run({
        sourceAdapter: config.sourceAdapter,
        query,
        dbSync,
      });

      mergeAccum(totals, batchStats);
      logBatch(batchStats, totals, batchCount);
    } catch (err) {
      console.error(
        `[runner] Batch ${batchCount} failed:`,
        err instanceof Error ? err.message : String(err),
      );
    }

    if (running && batchCount < maxBatches) {
      const jitter = Math.floor(Math.random() * jitterMs);
      const waitMs = delayMs + jitter;
      console.log(`[runner] Waiting ${(waitMs / 1000).toFixed(1)}s before next batch...`);
      await sleep(waitMs);
    }
  }

  console.log("\n[runner] Flushing pending writes and closing database connection...");
  await dbSync.close();
  console.log("[runner] Database connection closed.");

  logSummary(totals, batchCount);
  process.exit(0);
}