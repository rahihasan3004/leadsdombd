import crypto from "node:crypto";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { SourceAdapter, type RawBusinessRecord, type LocationSpec } from "../crawler.js";
import type { ResilientFetcher } from "../anti-ban.js";
import type { VerifiedLeadSource } from "../types/lead.types.js";

const NON_BUSINESS_NAMES = new Set([
  "botguard", "null", "undefined", "true", "false", "client", "maps",
  "google maps", "google", "javascript", "window", "document", "script",
  "bfkj", "bgdata", "preconnect", "stylesheet",
]);

function isReasonableName(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length < 2 || trimmed.length > 120) return false;
  if (NON_BUSINESS_NAMES.has(trimmed.toLowerCase())) return false;
  if (/^https?:\/\//i.test(trimmed)) return false;
  if (trimmed.startsWith("/maps/")) return false;
  if (trimmed.endsWith(".com") || trimmed.endsWith(".org") || trimmed.endsWith(".net")) return false;
  if (/^\+?\d[\d\s\-().]{6,}$/.test(trimmed)) return false;
  const alphaCount = (trimmed.match(/[A-Za-z]/g) || []).length;
  if (alphaCount < 2) return false;
  if (trimmed.length > 40 && /^[A-Za-z0-9+/=_-]{40,}$/.test(trimmed)) return false;
  return true;
}

function hasBusinessSignal(result: GoogleMapsPlaceResult): boolean {
  let signals = 0;
  if (result.rating > 0 && result.rating <= 5.0) signals++;
  if (result.reviewCount > 0) signals++;
  if (result.mainCategory && result.mainCategory.length > 1) signals++;
  if (result.address && result.address.length > 5) signals++;
  if (result.website && result.website.length > 10) signals++;
  if (result.phone && result.phone.length >= 10) signals++;
  if (result.subcategories.length > 0) signals++;
  return signals >= 2;
}

interface ParsedAgentName {
  fullName: string;
  firstName: string;
  lastName: string;
  brokerageName: string;
}

const BROKERAGE_DELIMITERS = [
  /\s+\|\s+/,
  /\s+at\s+/i,
  /\s*-\s*/,
];

const TITLE_SUFFIXES = /,?\s*(realtor|real estate agent|real estate broker|broker|agent|associate broker|team lead|sales associate|licensed salesperson|owner|principal|founder|partner|director|managing broker|designated broker|broker associate)\b\.?\s*/i;

function parseNameAndBrokerage(raw: string): ParsedAgentName {
  const trimmed = raw.trim();
  let personPart = trimmed;
  let brokeragePart = "";

  for (const delim of BROKERAGE_DELIMITERS) {
    const parts = trimmed.split(delim);
    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1]!;
      const rest = parts.slice(0, -1).join(" ");

      if (lastPart.length >= 3 && !/^\d/.test(lastPart) && rest.length >= 3) {
        personPart = rest;
        brokeragePart = lastPart;
        break;
      }
    }
  }

  personPart = personPart.replace(TITLE_SUFFIXES, " ").replace(/\s+/g, " ").trim();

  const nameParts = personPart.split(" ").filter((p) => p.length > 0);
  let firstName = "";
  let lastName = "";

  if (nameParts.length >= 2) {
    firstName = nameParts[0]!;
    lastName = nameParts[nameParts.length - 1]!;
  }

  if (!firstName || firstName.length < 2 || brokeragePart.length > personPart.length * 2) {
    return {
      fullName: trimmed,
      firstName: "",
      lastName: "",
      brokerageName: trimmed,
    };
  }

  return {
    fullName: `${firstName} ${lastName}`,
    firstName,
    lastName,
    brokerageName: brokeragePart || trimmed,
  };
}

function generateDeterministicPlaceId(companyName: string, city: string, state: string): string {
  const seed = `${companyName}|${city}|${state}`.toLowerCase().trim();
  return `gm_hash_${crypto.createHash("sha256").update(seed).digest("hex").slice(0, 16)}`;
}

interface GoogleMapsPlaceResult {
  name: string;
  placeId: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  website: string;
  rating: number;
  reviewCount: number;
  mainCategory: string;
  subcategories: string[];
  mapsLink: string;
}

const US_CITY_COORDS: Record<string, [number, number]> = {
  "miami": [25.7617, -80.1918],
  "orlando": [28.5383, -81.3792],
  "tampa": [27.9506, -82.4572],
  "jacksonville": [30.3322, -81.6557],
  "fort lauderdale": [26.1224, -80.1373],
  "new york": [40.7128, -74.0060],
  "los angeles": [34.0522, -118.2437],
  "chicago": [41.8781, -87.6298],
  "houston": [29.7604, -95.3698],
  "phoenix": [33.4484, -112.0740],
  "philadelphia": [39.9526, -75.1652],
  "san antonio": [29.4241, -98.4936],
  "san diego": [32.7157, -117.1611],
  "dallas": [32.7767, -96.7970],
  "austin": [30.2672, -97.7431],
  "san jose": [37.3382, -121.8863],
  "san francisco": [37.7749, -122.4194],
  "seattle": [47.6062, -122.3321],
  "denver": [39.7392, -104.9903],
  "boston": [42.3601, -71.0589],
  "atlanta": [33.7490, -84.3880],
  "washington": [38.9072, -77.0369],
};

function getCityCenter(city: string, state: string): [number, number] | null {
  const key = `${city}, ${state}`.toLowerCase();
  if (US_CITY_COORDS[key]) return US_CITY_COORDS[key];
  const cityKey = city.toLowerCase();
  if (US_CITY_COORDS[cityKey]) return US_CITY_COORDS[cityKey];
  return null;
}

function buildSearchUrl(category: string, location: LocationSpec): string {
  const cityPart = location.city ? `${location.city}, ` : "";
  const query = `${category} in ${cityPart}${location.state}`;
  if (location.city) {
    const center = getCityCenter(location.city, location.state);
    if (center) {
      return `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${center[0]},${center[1]},13z?hl=en`;
    }
  }
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=en`;
}

function buildPlaceUrl(placeId: string): string {
  return `https://www.google.com/maps/place/?q=place_id:${placeId}`;
}

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function handleConsent(page: Page): Promise<void> {
  const consentSelectors = [
    'button[aria-label*="Accept all"]',
    'button[aria-label*="Accept"]',
    'button[aria-label*="I agree"]',
    'button:has-text("Accept all")',
    'button:has-text("I agree")',
    'button:has-text("Got it")',
    'button:has-text("OK")',
    'form[action*="consent"] button',
    '[jsname][jsaction*="trigger"] button',
  ];

  for (const selector of consentSelectors) {
    try {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn.click({ timeout: 3000 });
        await page.waitForTimeout(1000);
        return;
      }
    } catch {
      continue;
    }
  }
}

async function scrollFeed(page: Page, scrollCount: number): Promise<void> {
  const feed = page.locator('div[role="feed"]');
  try {
    await feed.waitFor({ state: "visible", timeout: 10000 });
    for (let i = 0; i < scrollCount; i++) {
      await feed.evaluate((el) => {
        el.scrollBy({ top: el.scrollHeight, behavior: "smooth" });
      });
      await page.waitForTimeout(1500);
    }
    await page.waitForTimeout(1000);
  } catch {
    // Feed may not be scrollable — proceed with available cards
  }
}

interface ExtractedCard {
  name: string;
  placeId: string;
  mapsLink: string;
  address: string;
  phone: string;
  website: string;
  rating: number;
  reviewCount: number;
  mainCategory: string;
  subcategories: string[];
}

function cleanGoogleRedirectUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "www.google.com" || parsed.hostname === "google.com") {
      const q = parsed.searchParams.get("q") ?? parsed.searchParams.get("url");
      if (q) {
        const decoded = decodeURIComponent(q);
        try { new URL(decoded); return decoded; } catch { /* keep original */ }
      }
    }
  } catch {
    // keep original if not a valid URL
  }
  return url;
}

const BLOCKED_DOMAINS = new Set([
  "google.com", "www.google.com", "g.page", "maps.google.com",
  "w3.org", "schema.org", "facebook.com", "twitter.com", "instagram.com",
  "linkedin.com", "youtube.com",
]);

function filterBusinessUrl(raw: string): string {
  if (!raw) return "";
  try {
    const parsed = new URL(raw.replace(/\\u003d/g, "=").replace(/\\u0026/g, "&"));
    const hostname = parsed.hostname.toLowerCase();
    if (BLOCKED_DOMAINS.has(hostname)) return "";
    if (hostname.endsWith(".google.com")) return "";
    return raw;
  } catch {
    return "";
  }
}

async function extractListings(page: Page, location: LocationSpec): Promise<GoogleMapsPlaceResult[]> {
  const blockedDomainsArr = JSON.stringify([...BLOCKED_DOMAINS]);

  const results = await page.evaluate(
    `(function() {
      var blockedDomains = ${blockedDomainsArr};
      var blockedSet = new Set(blockedDomains);
      var cards = [];
      var seen = new Set();

      var extractPlaceId = function(href, card) {
        var ftidMatch = href.match(/[!?&]ftid=([^!&]+)/);
        if (ftidMatch && ftidMatch[1]) return decodeURIComponent(ftidMatch[1]);

        var dataMatch = href.match(/!1s([^!]+)!/);
        if (dataMatch && dataMatch[1]) {
          var raw = dataMatch[1].replace(/%20/g, "+");
          if (raw.length >= 27) return raw;
        }

        var hexMatch = href.match(/0x[0-9a-fA-F]+:0x[0-9a-fA-F]+/);
        if (hexMatch) return hexMatch[0];

        if (card instanceof HTMLElement) {
          var resultId = card.getAttribute("data-result-id");
          if (resultId) return resultId;
          var inner = card.querySelector("[data-result-id]");
          if (inner && inner.getAttribute("data-result-id")) return inner.getAttribute("data-result-id");
        }

        var pathMatch = href.match(/\\/place\\/([^/@?#]+)/);
        if (pathMatch && pathMatch[1]) return pathMatch[1];

        return "";
      };

      var cleanName = function(raw) {
        var name = raw.replace(/^\\s*\\d+(?:\\.\\d+)?\\s*\\(?\\d[\\d,]*\\)?\\s*/, "");
        name = name.replace(/·.*$/, "").trim();
        name = name.replace(/\\s*Open\\s+\\d.*$/i, "").trim();
        name = name.replace(/\\s*\\s*/g, "").trim();
        return name;
      };

      var extractRatingStars = function(card) {
        var rating = 0;
        var reviewCount = 0;
        var ratingEl = card.querySelector('[aria-label*="stars"], [aria-label*="Stars"], [role="img"][aria-label*="star"]');
        if (ratingEl) {
          var label = ratingEl.getAttribute("aria-label") || "";
          var starMatch = label.match(/(\\d+(?:\\.\\d+)?)\\s*(?:stars?|Stars?)/);
          if (starMatch && starMatch[1]) rating = parseFloat(starMatch[1]);
        }

        var text = card.textContent || "";

        var combinedMatch = text.match(/(\\d+(?:\\.\\d+)?)\\s*\\((\\d[\\d,]*)\\)/);
        if (combinedMatch && combinedMatch[1] && combinedMatch[2]) {
          if (!rating) rating = parseFloat(combinedMatch[1]);
          reviewCount = parseInt(combinedMatch[2].replace(/,/g, ""), 10);
        }

        if (!reviewCount) {
          var reviewMatch = text.match(/\\((\\d[\\d,]+)\\)/);
          if (reviewMatch && reviewMatch[1]) {
            var count = parseInt(reviewMatch[1].replace(/,/g, ""), 10);
            if (count > 0) reviewCount = count;
          }
        }

        if (!reviewCount) {
          var revWordMatch = text.match(/(\\d[\\d,]+)\\s*(?:reviews?|ratings?)/i);
          if (revWordMatch && revWordMatch[1]) {
            reviewCount = parseInt(revWordMatch[1].replace(/,/g, ""), 10);
          }
        }

        return { rating: rating, reviewCount: reviewCount };
      };

      var extractAddress = function(text) {
        var parts = text.split("·").map(function(s) { return s.trim(); });
        for (var i = 0; i < parts.length; i++) {
          var part = parts[i];
          var cleaned = part.replace(/Open\\s+\\d.*$/i, "").trim();
          if (/\\d{1,6}\\s+[A-Z]/.test(cleaned) && cleaned.length > 8 && !/stars?|review|rating|/i.test(cleaned)) {
            var striped = cleaned.replace(/^[^a-zA-Z\\d]*\\d+\\.?\\d*\\s*/, "");
            var m = striped.match(/(\\d+[^,]{3,120}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl|Circle|Cir|Trail|Trl|Parkway|Pkwy|Highway|Hwy|Loop|Square|Sq|Bend|Row|Alley)[^,\\n]{0,80}(?:,\\s*[A-Z]{2}\\s*\\d{5})?)/i);
            if (m && m[1]) return m[1].trim();
            return striped.split(/[]/)[0].trim();
          }
        }
        return "";
      };

      var extractPhone = function(text) {
        var phoneMatch = text.match(/(?:\\+?1[-.\\s]?)?\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}/);
        return phoneMatch ? phoneMatch[0] : "";
      };

      var extractWebsite = function(card) {
        if (!(card instanceof HTMLElement)) return "";

        var websiteLinks = card.querySelectorAll('a[data-value="Website"], a[aria-label*="Website"], a[aria-label*="website"]');
        for (var i = 0; i < websiteLinks.length; i++) {
          var raw = websiteLinks[i].href;
          if (!raw) continue;
          try {
            var host = new URL(raw).hostname;
            if (!raw.includes("google.com/maps") && !raw.includes("g.page") && !blockedSet.has(host)) {
              return raw;
            }
          } catch (e) { continue; }
        }

        var allLinks = card.querySelectorAll("a[href]");
        for (var j = 0; j < allLinks.length; j++) {
          var raw2 = allLinks[j].href;
          if (!raw2 || raw2.includes("google.com/maps") || raw2.includes("g.page") || raw2.includes("youtube.com")) continue;
          try {
            var host2 = new URL(raw2).hostname;
            if (!blockedSet.has(host2)) return raw2;
          } catch (e) { continue; }
        }
        return "";
      };

      var extractCategory = function(text) {
        var subs = [];
        var catMatch = text.match(/(?:Real Estate Agent|Brokerage|Property Manager|Real Estate Agency|Real Estate|Mortgage|Insurance|Title Company|Home Builder|Appraiser|Home Inspector|Real Estate Attorney|Real Estate Consultant|Real Estate Developer)/gi);
        if (catMatch) {
          var main = catMatch[0];
          for (var i = 1; i < catMatch.length; i++) {
            if (catMatch[i]) subs.push(catMatch[i]);
          }
          var uniqueSubs = [];
          var subSeen = {};
          for (var k = 0; k < subs.length; k++) {
            if (!subSeen[subs[k]]) { subSeen[subs[k]] = true; uniqueSubs.push(subs[k]); }
          }
          return { main: main, subs: uniqueSubs };
        }
        return { main: "", subs: [] };
      };

      var feed = document.querySelector('div[role="feed"]');
      var container = feed || document;

      var placeLinks = container.querySelectorAll('a[href*="/maps/place/"]');

      for (var li = 0; li < placeLinks.length; li++) {
        var link = placeLinks[li];
        var href = link.getAttribute("href") || "";
        if (!href) continue;

        var card = link.closest('[role="article"], [data-result-id]') || link.parentElement || link;
        var placeId = extractPlaceId(link.href, card);
        if (!placeId || seen.has(placeId)) continue;
        seen.add(placeId);

        var fullHref = link.href || ("https://www.google.com" + href);
        var ariaLabel = (link.getAttribute("aria-label") || "").trim();

        var text = card.textContent || "";

        var name = cleanName(ariaLabel);
        if (!name && card instanceof HTMLElement) {
          var heading = card.querySelector('div[class*="fontHeadline"], span[class*="fontHeadline"], h1, h2, h3, [class*="title"]');
          name = heading ? (heading.textContent || "").trim() : "";
          name = cleanName(name);
        }
        if (!name) {
          var lines = text.split("\\n");
          var firstLine = "";
          for (var fl = 0; fl < lines.length; fl++) {
            if (lines[fl].trim().length > 2) { firstLine = lines[fl].trim(); break; }
          }
          name = cleanName(firstLine);
        }
        if (name.length > 120) name = name.slice(0, 120);

        var ratingData = extractRatingStars(card);
        var address = extractAddress(text);
        var phone = extractPhone(text);
        var website = extractWebsite(card);
        var catData = extractCategory(text);

        cards.push({
          name: name,
          placeId: placeId,
          mapsLink: fullHref,
          address: address,
          phone: phone,
          website: website,
          rating: ratingData.rating,
          reviewCount: ratingData.reviewCount,
          mainCategory: catData.main,
          subcategories: catData.subs,
        });
      }

      return cards;
    })()` as string,
  );

  const mapped: GoogleMapsPlaceResult[] = [];
  for (const card of (results as GoogleMapsPlaceResult[])) {
    if (!isReasonableName(card.name)) continue;

    card.website = cleanGoogleRedirectUrl(card.website);
    card.website = filterBusinessUrl(card.website);

    let city = location.city ?? "";
    let state = location.state;
    let zipCode = "";

    if (card.address) {
      const stateMatch = /\b([A-Z]{2})\b/.exec(card.address);
      const zipMatch = /\b(\d{5})(?:-\d{4})?\b/.exec(card.address);
      if (stateMatch?.[1]) state = stateMatch[1];
      if (zipMatch?.[1]) {
        zipCode = zipMatch[1];
      } else if (location.zipCode) {
        zipCode = location.zipCode;
      }
      const commaIdx = card.address.indexOf(",");
      if (commaIdx > 0) {
        const cityMatch = /^([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/.exec(card.address.slice(commaIdx + 1).trim());
        if (cityMatch?.[1]) city = cityMatch[1];
      }
    }

    const result: GoogleMapsPlaceResult = {
      name: card.name,
      placeId: card.placeId,
      address: card.address,
      city,
      state,
      zipCode,
      phone: card.phone,
      website: card.website,
      rating: card.rating,
      reviewCount: card.reviewCount,
      mainCategory: card.mainCategory,
      subcategories: card.subcategories,
      mapsLink: card.mapsLink || buildPlaceUrl(card.placeId),
    };

    if (!hasBusinessSignal(result)) continue;

    mapped.push(result);
  }

  return mapped;
}

// ---------------------------------------------------------------------------
// Bounded LRU Set — prevents unbounded heap growth in 24/7 mode
// ---------------------------------------------------------------------------

class LruSet<T> {
  private readonly map = new Map<T, true>();
  private readonly max: number;

  constructor(max: number) {
    this.max = max;
  }

  has(value: T): boolean {
    const found = this.map.has(value);
    if (found) {
      this.map.delete(value);
      this.map.set(value, true);
    }
    return found;
  }

  add(value: T): void {
    if (this.map.has(value)) return;
    if (this.map.size >= this.max) {
      const first = this.map.keys().next().value;
      if (first !== undefined) this.map.delete(first);
    }
    this.map.set(value, true);
  }

  clear(): void {
    this.map.clear();
  }
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

const DEDUP_PLACE_IDS = new LruSet<string>(50_000);

export class GoogleMapsAdapter extends SourceAdapter {
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

    try {
      browser = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
          "--disable-infobars",
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

      const page = await context.newPage();

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

      await page.waitForTimeout(2000);

      await handleConsent(page);

      try {
        await page.waitForSelector('div[role="feed"]', { timeout: 20000 });
      } catch {
        await context.close();
        await browser.close();
        return;
      }

      await page.waitForTimeout(1500);

      await scrollFeed(page, 4);

      const parsed = await extractListings(page, location);

      await page.close();
      await context.close();
      await browser.close();
      browser = null;
      context = null;

      let yielded = 0;

      for (const result of parsed) {
        if (signal?.aborted) return;
        if (yielded >= limit) return;

        if (DEDUP_PLACE_IDS.has(result.placeId)) continue;
        DEDUP_PLACE_IDS.add(result.placeId);

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
            googleMapsLink: result.mapsLink,
          },
          { category, state: location.state },
        );

        yield record;
        yielded++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `GoogleMapsAdapter browser search failed for "${category}" in ${location.city ?? ""}, ${location.state}: ${message}`,
      );
    } finally {
      if (context && browser) {
        try { await context.close(); } catch { /* ignore */ }
        try { await browser.close(); } catch { /* ignore */ }
      }
    }
  }
}

export function clearDedupCache(): void {
  DEDUP_PLACE_IDS.clear();
}