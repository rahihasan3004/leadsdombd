import { buildApifySearchStrings } from "./apify-client";
import type { USState } from "@fine-leads/utils";
import { US_ZIP_CODE_REGISTRY } from "@fine-leads/utils/territories/us-zip-codes";

export interface ApifyTerritoryRun {
  state: string;
  targetQuantity: number;
  zipCode: string | null;
  runId: string | null;
}

/** Conservative coverage for legacy multi-ZIP runs; explicit retry ZIPs are durable. */
export function nextApifyZip(
  states: string[],
  history: ApifyTerritoryRun[],
): { state: string; zipCode: string } | null {
  const used = new Set<string>();
  for (const run of history) {
    if (run.zipCode) used.add(`${run.state}:${run.zipCode}`);
    else if (run.runId?.startsWith("apify:")) {
      for (const query of buildApifySearchStrings({
        stateCode: run.state,
        maxQueries: Math.min(20, run.targetQuantity),
      })) {
        const zip = query.match(/ (\d{5})$/)?.[1];
        if (zip) used.add(`${run.state}:${zip}`);
      }
    }
  }
  // The registry provides a finite, stable territory plan. Never retry an exhausted ZIP.
  for (const state of states) {
    for (const zipCode of US_ZIP_CODE_REGISTRY[state as USState].cities.flatMap(
      (city) => city.zipCodes,
    )) {
      if (zipCode && !used.has(`${state}:${zipCode}`))
        return { state, zipCode };
    }
  }
  return null;
}

/** Finite paid-run ceiling; uncertainty/quota errors retain their existing protections. */
export function apifyMaxFulfillmentRuns(): number {
  const value = Number(process.env.APIFY_MAX_FULFILLMENT_RUNS ?? 20);
  return Number.isSafeInteger(value) && value >= 1 && value <= 100 ? value : 20;
}
