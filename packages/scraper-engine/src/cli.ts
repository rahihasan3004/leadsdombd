import { runContinuous, type RunnerConfig } from "./runner.js";
import { getEnv } from "./config/env.js";
import type { SourceAdapter } from "./crawler.js";
import { US_STATES } from "./crawler.js";
import { MASTER_CATEGORIES } from "./config/categories.js";
import { createGoogleMapsAdapter } from "./adapters/index.js";

async function main(): Promise<void> {
  const env = getEnv();

  const nichesRaw = process.env["SCRAPER_NICHES"];
  const statesRaw = process.env["SCRAPER_STATES"];
  const citiesRaw = process.env["SCRAPER_CITIES"];
  const adapterPath = process.env["SCRAPER_ADAPTER_MODULE"];
  const cityDelay = process.env["SCRAPER_CITY_BATCH_DELAY_MS"];
  const jitter = process.env["SCRAPER_JITTER_MS"];
  const maxBatches = process.env["SCRAPER_MAX_BATCHES"];

  const niches = nichesRaw
    ? nichesRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : MASTER_CATEGORIES;

  if (niches.length === 0) {
    console.error("No niches configured. Set SCRAPER_NICHES or ensure MASTER_CATEGORIES is populated.");
    process.exit(1);
  }

  const states = statesRaw
    ? statesRaw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : Object.keys(US_STATES);

  if (states.length === 0) {
    console.error("No states configured. Set SCRAPER_STATES or ensure US_STATES is populated.");
    process.exit(1);
  }

  let sourceAdapter: SourceAdapter;

  if (adapterPath) {
    let SourceAdapterClass: new () => SourceAdapter;

    try {
      const mod = await import(adapterPath);
      SourceAdapterClass = mod.default ?? mod.SourceAdapter ?? mod.GoogleMapsAdapter;
      if (!SourceAdapterClass) {
        console.error(`Could not find a SourceAdapter export in module: ${adapterPath}`);
        process.exit(1);
      }
    } catch (err) {
      console.error(
        `Failed to load adapter module "${adapterPath}":`,
        err instanceof Error ? err.message : String(err),
      );
      process.exit(1);
    }

    sourceAdapter = new SourceAdapterClass();
  } else {
    sourceAdapter = createGoogleMapsAdapter(env.SCRAPER_ENGINE_VARIANT);
  }

  const config: RunnerConfig = {
    sourceAdapter,
    niches,
    states,
    cities: citiesRaw
      ? citiesRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined,
    cityBatchDelayMs: cityDelay ? parseInt(cityDelay, 10) : undefined,
    jitterMs: jitter ? parseInt(jitter, 10) : undefined,
    maxBatches: maxBatches ? parseInt(maxBatches, 10) : undefined,
  };

  console.log("[cli] Starting scraper engine runner");
  console.log(`[cli] Niches: ${config.niches.join(", ")}`);
  console.log(`[cli] States: ${config.states.join(", ")}`);
  if (config.cities) {
    console.log(`[cli] Cities: ${config.cities.join(", ")}`);
  }
  console.log(`[cli] Concurrency: ${env.CONCURRENCY_LIMIT}`);

  await runContinuous(config);
}

main().catch((err) => {
  console.error("[cli] Fatal error:", err);
  process.exit(1);
});