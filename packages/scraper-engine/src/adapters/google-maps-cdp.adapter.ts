/**
 * Google Maps CDP Network Interception Adapter
 *
 * Architectural Pattern: Protocol-Level CDP Network Interception with
 * In-Flight Circuit-Breaker DOM Fallback.
 *
 * Instead of parsing fragile presentation-layer DOM, this adapter
 * intercepts Google Maps internal RPC response payloads directly off
 * the wire via Chrome DevTools Protocol (CDP). When network-payload
 * extraction yields zero entities, it gracefully falls back to rendered
 * DOM extraction as a circuit-breaker failover.
 *
 * Origination / Reference: Inspired by and adapted from Akkhar-Magic
 * (akkhar-labs/akkhar-magic), developed by Akkhar-Labs (Rahat Hasan).
 *
 * @see https://github.com/akkhar-labs/akkhar-magic
 */

import { chromium, type Browser, type BrowserContext, type Page, type CDPSession } from "playwright";
import { SourceAdapter, type RawBusinessRecord, type LocationSpec } from "../crawler.js";
import type { ResilientFetcher } from "../anti-ban.js";
import type { VerifiedLeadSource } from "../types/lead.types.js";
import {
  buildSearchUrl,
  getCityCenter,
  CHROME_UA,
  handleConsent,
  scrollFeed,
  extractListings,
  parseNameAndBrokerage,
  buildPlaceUrl,
} from "./google-maps.adapter.js";

interface CdpPlaceCandidate {
  name: string;
  placeId: string;
  address: string;
  phone: string;
  website: string;
  rating: number | null;
  reviewCount: number | null;
  mainCategory: string;
  subcategories: string[];
}

function parseMapsRpcBody(body: string): CdpPlaceCandidate[] {
  const candidates: CdpPlaceCandidate[] = [];
  let cleaned = body;
  if (cleaned.startsWith(")]}'\n")) {
    cleaned = cleaned.slice(5);
  } else if (cleaned.startsWith(")]}'")) {
    cleaned = cleaned.slice(4);
  }

  let root: unknown;
  try {
    root = JSON.parse(cleaned);
  } catch {
    return candidates;
  }

  if (!Array.isArray(root)) return candidates;

  const seenPlaceIds = new Set<string>();

  function extractPlaces(arr: unknown[], depth = 0): void {
    if (depth > 20) return;
    if (!Array.isArray(arr)) return;

    for (const item of arr) {
      if (!Array.isArray(item)) continue;

      const first = item[0];
      if (typeof first === "string" && first.length >= 27 && first.includes("ChIJ")) {
        const entry = parseRpcEntry(item);
        if (entry && entry.placeId && !seenPlaceIds.has(entry.placeId)) {
          seenPlaceIds.add(entry.placeId);
          candidates.push(entry);
        }
      } else if (Array.isArray(first)) {
        extractPlaces(item, depth + 1);
      }

      for (let i = 1; i < item.length; i++) {
        if (Array.isArray(item[i])) {
          extractPlaces(item[i], depth + 1);
        }
      }
    }
  }

  extractPlaces(root);

  return candidates;
}

function parseRpcEntry(item: unknown[]): CdpPlaceCandidate | null {
  try {
    const flat = flattenArray(item);
    const text = flat.join(" ");

    const placeId = extractPlaceIdFromFlat(flat);
    if (!placeId) return null;

    const name = extractNameFromFlat(flat, text);
    if (!name) return null;

    const rating = extractRatingFromFlat(flat);
    const reviewCount = extractReviewCountFromFlat(flat);
    const phone = extractPhoneFromText(text);
    const website = extractWebsiteFromFlat(flat);
    const address = extractAddressFromFlat(flat);
    const { mainCategory, subcategories } = extractCategoriesFromFlat(flat);

    return { name, placeId, address, phone, website, rating, reviewCount, mainCategory, subcategories };
  } catch {
    return null;
  }
}

function flattenArray(arr: unknown[], maxLen = 500): string[] {
  const out: string[] = [];
  function walk(v: unknown): void {
    if (out.length >= maxLen) return;
    if (Array.isArray(v)) {
      for (const child of v) {
        if (out.length >= maxLen) break;
        walk(child);
      }
    } else if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out.push(String(v));
    }
  }
  walk(arr);
  return out;
}

function extractPlaceIdFromFlat(flat: string[]): string | null {
  for (const s of flat) {
    if (typeof s === "string" && s.startsWith("ChIJ") && s.length >= 27) {
      return s;
    }
  }
  return null;
}

function extractNameFromFlat(flat: string[], text: string): string | null {
  for (let i = 0; i < flat.length; i++) {
    const s = flat[i]!;
    if (s.length > 2 && s.length < 120 && /^[A-Z][a-zA-Z\s'.&-]+$/.test(s)) {
      if (!/^(https?:\/\/|www\.)/i.test(s) && !s.startsWith("ChIJ") && !s.startsWith("+1")) {
        const nextIsRating = i + 1 < flat.length && /^\d+(\.\d+)?$/.test(flat[i + 1]!);
        if (nextIsRating) return s;
      }
    }
  }

  const nameMatch = text.match(/([A-Z][a-zA-Z\s'.&-]{2,60}(?:Real Estate|Brokerage|Agency|Properties|Team|Group|Realtor|Realty))/);
  if (nameMatch?.[1]) return nameMatch[1].trim();

  return null;
}

function extractRatingFromFlat(flat: string[]): number | null {
  for (const s of flat) {
    const num = parseFloat(s);
    if (!isNaN(num) && num > 0 && num <= 5.0) {
      const idx = flat.indexOf(s);
      if (idx > 0) {
        const prev = flat[idx - 1]!;
        if (prev.length > 2 && /[A-Za-z]/.test(prev)) return num;
      }
      return num;
    }
  }
  return null;
}

function extractReviewCountFromFlat(flat: string[]): number | null {
  for (const s of flat) {
    const num = parseInt(s.replace(/,/g, ""), 10);
    if (!isNaN(num) && num > 0 && num < 1000000) {
      const idx = flat.indexOf(s);
      if (idx > 0 && idx < flat.length - 1) {
        const next = flat[idx + 1]!;
        if (/review/i.test(next) || /rating/i.test(next)) return num;
      }
    }
  }
  return null;
}

function extractPhoneFromText(text: string): string {
  const match = text.match(
    /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
  );
  return match ? match[0] : "";
}

function extractWebsiteFromFlat(flat: string[]): string {
  for (const s of flat) {
    if (/^https?:\/\//i.test(s) && !s.includes("google.com") && !s.includes("g.page") && !s.includes("youtube.com")) {
      return s;
    }
  }
  return "";
}

function extractAddressFromFlat(flat: string[]): string {
  const joined = flat.join(" ");
  const addrMatch = joined.match(
    /\d{1,6}\s+[A-Za-z][A-Za-z\s.]{2,60}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl|Circle|Cir|Trail|Trl|Parkway|Pkwy|Highway|Hwy|Loop|Square|Sq|Bend|Row|Alley)[^]{0,80}(?:,\s*[A-Z]{2}\s*\d{5})/i,
  );
  return addrMatch ? addrMatch[0].trim() : "";
}

function extractCategoriesFromFlat(flat: string[]): {
  mainCategory: string;
  subcategories: string[];
} {
  const subs: string[] = [];
  for (const s of flat) {
    if (/real estate/i.test(s) || /brokerage/i.test(s) || /property management/i.test(s)) {
      if (!subs.includes(s)) subs.push(s);
    }
  }
  return {
    mainCategory: subs[0] ?? "",
    subcategories: subs.slice(1),
  };
}

function isCdpCandidateValid(candidate: CdpPlaceCandidate): boolean {
  if (!candidate.name || candidate.name.length < 2) return false;
  if (/^https?:\/\//i.test(candidate.name)) return false;
  if (/^\+?\d[\d\s\-().]{6,}$/.test(candidate.name)) return false;

  let signals = 0;
  if (candidate.rating !== null && candidate.rating > 0 && candidate.rating <= 5.0) signals++;
  if (candidate.reviewCount !== null && candidate.reviewCount > 0) signals++;
  if (candidate.address && candidate.address.length > 5) signals++;
  if (candidate.website && candidate.website.length > 10) signals++;
  if (candidate.phone && candidate.phone.length >= 10) signals++;
  if (candidate.mainCategory && candidate.mainCategory.length > 1) signals++;

  return signals >= 1;
}

interface RpcResponseBuffer {
  url: string;
  body: string;
}

const CDP_RPC_PATTERNS = [
  "/maps/preview/search",
  "/maps/rpc",
  "/maps/preview/place",
];

export class GoogleMapsCdpAdapter extends SourceAdapter {
  override readonly source: VerifiedLeadSource = "google_maps";

  override async *search(params: {
    category: string;
    location: LocationSpec;
    limit: number;
    fetcher: ResilientFetcher;
    signal?: AbortSignal;
  }): AsyncIterable<RawBusinessRecord> {
    const { category, location, limit, signal } = params;

    if (signal?.aborted) return;

    const url = buildSearchUrl(category, location);
    const coords = getCityCenter(location.city ?? "", location.state) ?? [25.7617, -80.1918];

    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    let page: Page | null = null;
    let cdpSession: CDPSession | null = null;

    const rpcResponses: RpcResponseBuffer[] = [];

    try {
      browser = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
          "--disable-infobars",
          "--remote-debugging-port=0",
        ],
      });

      context = await browser.newContext({
        locale: "en-US",
        timezoneId: "America/New_York",
        userAgent: CHROME_UA,
        geolocation: { latitude: coords[0], longitude: coords[1] },
        permissions: ["geolocation"],
        viewport: { width: 1280, height: 900 },
      });

      page = await context.newPage();

      cdpSession = await page.context().newCDPSession(page);
      await cdpSession.send("Network.enable");

      const responseHandler = async (response: { url: string; body: string }) => {
        const matched = CDP_RPC_PATTERNS.some((p) => response.url.includes(p));
        if (!matched) return;

        const bodyStr = response.body;
        if (!bodyStr || bodyStr.length < 100) return;
        if (bodyStr.includes("<!DOCTYPE html") || bodyStr.includes("<html")) return;

        rpcResponses.push({ url: response.url, body: bodyStr });
      };

      cdpSession.on("Network.responseReceived", async (event) => {
        try {
          const respUrl = event.response.url;
          const matched = CDP_RPC_PATTERNS.some((p) => respUrl.includes(p));
          if (!matched) return;

          const response = await cdpSession!.send("Network.getResponseBody", {
            requestId: event.requestId,
          });

          responseHandler({
            url: respUrl,
            body: response.body,
          });
        } catch {
          // Response body may not be available (redirects, etc.)
        }
      });

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2000);
      await handleConsent(page);

      try {
        await page.waitForSelector('div[role="feed"]', { timeout: 20000 });
      } catch {
        console.warn("[GoogleMapsCdpAdapter] Feed not found, page may be blocked");
        await context.close();
        await browser.close();
        return;
      }

      await page.waitForTimeout(1500);
      await scrollFeed(page, 4);

      await page.waitForTimeout(2000);

      let yielded = 0;

      const cdpPlaceIds = new Set<string>();
      const cdpRecords: RawBusinessRecord[] = [];

      for (const rpc of rpcResponses) {
        const candidates = parseMapsRpcBody(rpc.body);
        for (const candidate of candidates) {
          if (!isCdpCandidateValid(candidate)) continue;
          if (cdpPlaceIds.has(candidate.placeId)) continue;
          cdpPlaceIds.add(candidate.placeId);

          const parsedName = parseNameAndBrokerage(candidate.name);

          const record = this.toRecord(
            {
              companyName: candidate.name,
              firstName: parsedName.firstName,
              lastName: parsedName.lastName,
              brokerageName: parsedName.brokerageName,
              phone: candidate.phone,
              city: location.city || "",
              state: location.state,
              zipCode: "",
              address: candidate.address,
              website: candidate.website,
              rating: candidate.rating,
              reviewCount: candidate.reviewCount,
              googleMainCategory: candidate.mainCategory,
              googleSubcategories: candidate.subcategories.join(", "),
              googlePlaceId: candidate.placeId,
              googleMapsLink: buildPlaceUrl(candidate.placeId),
            },
            { category, state: location.state },
          );

          cdpRecords.push(record);
        }
      }

      if (cdpRecords.length > 0) {
        console.log(`[GoogleMapsCdpAdapter] CDP successfully captured ${cdpRecords.length} records from wire`);

        for (const record of cdpRecords) {
          if (signal?.aborted) return;
          if (yielded >= limit) return;

          yield record;
          yielded++;
        }
      }

      if (yielded === 0) {
        console.warn(
          "[GoogleMapsCdpAdapter] CDP yielded 0 records. Handing over to DOM fallback scraper on active page.",
        );

        const domResults = await extractListings(page!, location);

        for (const result of domResults) {
          if (signal?.aborted) return;
          if (yielded >= limit) return;

          const parsedName = parseNameAndBrokerage(result.name);

          const record = this.toRecord(
            {
              companyName: result.name,
              firstName: parsedName.firstName,
              lastName: parsedName.lastName,
              brokerageName: parsedName.brokerageName,
              phone: result.phone,
              city: result.city || location.city || "",
              state: result.state || location.state,
              zipCode: result.zipCode,
              address: result.address,
              website: result.website,
              rating: result.rating,
              reviewCount: result.reviewCount,
              googleMainCategory: result.mainCategory,
              googleSubcategories: result.subcategories.join(", "),
              googlePlaceId: result.placeId,
              googleMapsLink: result.mapsLink || buildPlaceUrl(result.placeId),
            },
            { category, state: location.state },
          );

          yield record;
          yielded++;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `GoogleMapsCdpAdapter browser search failed for "${category}" in ${location.city ?? ""}, ${location.state}: ${message}`,
      );
    } finally {
      if (cdpSession) {
        try {
          await cdpSession.detach();
        } catch {
          /* ignore */
        }
      }
      if (page) {
        try {
          await page.close();
        } catch {
          /* ignore */
        }
      }
      if (context) {
        try {
          await context.close();
        } catch {
          /* ignore */
        }
      }
      if (browser) {
        try {
          await browser.close();
        } catch {
          /* ignore */
        }
      }
    }
  }
}

export function clearDedupCache(): void {
  // no-op: CDP adapter doesn't use a shared dedup cache
}