import { ResilientFetcher, type FetchResponse, type RateLimiter } from "./anti-ban.js";
import type { VerifiedLeadPayload, VerifiedLeadSource } from "./types/lead.types.js";

// ---------------------------------------------------------------------------
// US Location Data
// ---------------------------------------------------------------------------

export const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia",
};

export const STATE_TIMEZONE: Record<string, string> = {
  AL: "CST", AK: "AKST", AZ: "MST", AR: "CST", CA: "PST",
  CO: "MST", CT: "EST", DE: "EST", FL: "EST", GA: "EST",
  HI: "HST", ID: "MST", IL: "CST", IN: "EST", IA: "CST",
  KS: "CST", KY: "EST", LA: "CST", ME: "EST", MD: "EST",
  MA: "EST", MI: "EST", MN: "CST", MS: "CST", MO: "CST",
  MT: "MST", NE: "CST", NV: "PST", NH: "EST", NJ: "EST",
  NM: "MST", NY: "EST", NC: "EST", ND: "CST", OH: "EST",
  OK: "CST", OR: "PST", PA: "EST", RI: "EST", SC: "EST",
  SD: "CST", TN: "CST", TX: "CST", UT: "MST", VT: "EST",
  VA: "EST", WA: "PST", WV: "EST", WI: "CST", WY: "MST",
  DC: "EST",
};

export const MAJOR_CITIES: Record<string, string[]> = {
  AL: ["Birmingham", "Montgomery", "Huntsville", "Mobile", "Tuscaloosa"],
  AK: ["Anchorage", "Fairbanks", "Juneau", "Sitka", "Ketchikan"],
  AZ: ["Phoenix", "Tucson", "Mesa", "Chandler", "Scottsdale"],
  AR: ["Little Rock", "Fort Smith", "Fayetteville", "Springdale", "Jonesboro"],
  CA: ["Los Angeles", "San Francisco", "San Diego", "San Jose", "Sacramento", "Fresno", "Long Beach", "Oakland"],
  CO: ["Denver", "Colorado Springs", "Aurora", "Fort Collins", "Lakewood"],
  CT: ["Bridgeport", "New Haven", "Hartford", "Stamford", "Waterbury"],
  DE: ["Wilmington", "Dover", "Newark", "Middletown", "Smyrna"],
  FL: ["Miami", "Orlando", "Tampa", "Jacksonville", "Fort Lauderdale", "Tallahassee", "St. Petersburg"],
  GA: ["Atlanta", "Augusta", "Columbus", "Savannah", "Athens"],
  HI: ["Honolulu", "Hilo", "Kailua", "Kapolei", "Kaneohe"],
  ID: ["Boise", "Meridian", "Nampa", "Idaho Falls", "Pocatello"],
  IL: ["Chicago", "Aurora", "Naperville", "Joliet", "Rockford", "Springfield"],
  IN: ["Indianapolis", "Fort Wayne", "Evansville", "South Bend", "Carmel"],
  IA: ["Des Moines", "Cedar Rapids", "Davenport", "Sioux City", "Iowa City"],
  KS: ["Wichita", "Overland Park", "Kansas City", "Olathe", "Topeka"],
  KY: ["Louisville", "Lexington", "Bowling Green", "Owensboro", "Covington"],
  LA: ["New Orleans", "Baton Rouge", "Shreveport", "Lafayette", "Lake Charles"],
  ME: ["Portland", "Lewiston", "Bangor", "South Portland", "Auburn"],
  MD: ["Baltimore", "Columbia", "Germantown", "Silver Spring", "Waldorf"],
  MA: ["Boston", "Worcester", "Springfield", "Cambridge", "Lowell"],
  MI: ["Detroit", "Grand Rapids", "Warren", "Sterling Heights", "Ann Arbor"],
  MN: ["Minneapolis", "Saint Paul", "Rochester", "Duluth", "Bloomington"],
  MS: ["Jackson", "Gulfport", "Southaven", "Hattiesburg", "Biloxi"],
  MO: ["Kansas City", "St. Louis", "Springfield", "Columbia", "Independence"],
  MT: ["Billings", "Missoula", "Great Falls", "Bozeman", "Butte"],
  NE: ["Omaha", "Lincoln", "Bellevue", "Grand Island", "Kearney"],
  NV: ["Las Vegas", "Henderson", "Reno", "North Las Vegas", "Sparks"],
  NH: ["Manchester", "Nashua", "Concord", "Derry", "Dover"],
  NJ: ["Newark", "Jersey City", "Paterson", "Elizabeth", "Trenton"],
  NM: ["Albuquerque", "Las Cruces", "Santa Fe", "Rio Rancho", "Roswell"],
  NY: ["New York", "Buffalo", "Rochester", "Yonkers", "Syracuse", "Albany"],
  NC: ["Charlotte", "Raleigh", "Greensboro", "Durham", "Winston-Salem"],
  ND: ["Fargo", "Bismarck", "Grand Forks", "Minot", "West Fargo"],
  OH: ["Columbus", "Cleveland", "Cincinnati", "Toledo", "Akron"],
  OK: ["Oklahoma City", "Tulsa", "Norman", "Broken Arrow", "Edmond"],
  OR: ["Portland", "Salem", "Eugene", "Gresham", "Hillsboro"],
  PA: ["Philadelphia", "Pittsburgh", "Allentown", "Erie", "Reading"],
  RI: ["Providence", "Warwick", "Cranston", "Pawtucket", "East Providence"],
  SC: ["Columbia", "Charleston", "North Charleston", "Mount Pleasant", "Greenville"],
  SD: ["Sioux Falls", "Rapid City", "Aberdeen", "Brookings", "Watertown"],
  TN: ["Nashville", "Memphis", "Knoxville", "Chattanooga", "Clarksville"],
  TX: ["Houston", "San Antonio", "Dallas", "Austin", "Fort Worth", "El Paso", "Arlington"],
  UT: ["Salt Lake City", "West Valley City", "Provo", "West Jordan", "Orem"],
  VT: ["Burlington", "South Burlington", "Rutland", "Barre", "Montpelier"],
  VA: ["Virginia Beach", "Norfolk", "Chesapeake", "Richmond", "Newport News"],
  WA: ["Seattle", "Spokane", "Tacoma", "Vancouver", "Bellevue"],
  WV: ["Charleston", "Huntington", "Morgantown", "Parkersburg", "Wheeling"],
  WI: ["Milwaukee", "Madison", "Green Bay", "Kenosha", "Racine"],
  WY: ["Cheyenne", "Casper", "Laramie", "Gillette", "Rock Springs"],
  DC: ["Washington"],
};

// ---------------------------------------------------------------------------
// Core Types
// ---------------------------------------------------------------------------

export interface LocationSpec {
  state: string;
  city?: string;
  zipCode?: string;
}

export interface DiscoveryQuery {
  category: string;
  locations: LocationSpec[];
  limitPerLocation?: number;
  source?: VerifiedLeadSource;
}

export interface RawBusinessRecord {
  companyName: string;
  firstName?: string;
  lastName?: string;
  brokerageName?: string;
  phone: string;
  state: string;
  zipCode: string;
  city: string;
  timezone: string;
  address: string;
  category: string;
  googleMainCategory: string;
  googleSubcategories: string;
  website: string;
  rating: number;
  reviewCount: number;
  scrapedAt: string;
  googlePlaceId: string;
  googleMapsLink: string;
}

export interface CrawlerResult {
  record: RawBusinessRecord;
  source: VerifiedLeadSource;
  queryLocation: string;
}

export type CrawlerErrorType =
  | "network"
  | "parse"
  | "rate_limited"
  | "timeout"
  | "unknown";

export interface CrawlerErrorEntry {
  type: CrawlerErrorType;
  message: string;
  queryLocation: string;
  category: string;
  timestamp: string;
}

export interface CrawlerProgress {
  totalQueries: number;
  completedQueries: number;
  totalRecords: number;
  errors: CrawlerErrorEntry[];
}

export type CrawlerEvent =
  | { type: "record"; data: CrawlerResult }
  | { type: "error"; data: CrawlerErrorEntry }
  | { type: "progress"; data: CrawlerProgress };

// ---------------------------------------------------------------------------
// Source Adapter
// ---------------------------------------------------------------------------

export abstract class SourceAdapter {
  abstract readonly source: VerifiedLeadSource;

  abstract search(params: {
    category: string;
    location: LocationSpec;
    limit: number;
    fetcher: ResilientFetcher;
    signal?: AbortSignal;
  }): AsyncIterable<RawBusinessRecord>;

  protected deriveTimezone(state: string): string {
    return STATE_TIMEZONE[state.toUpperCase()] ?? "EST";
  }

  protected normalizePhone(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    if (digits.length === 11 && digits.startsWith("1")) {
      return `+${digits}`;
    }
    return digits.replace(/^\+?1?(\d{10}).*$/, "+1$1") || raw;
  }

  protected normalizeUrl(raw: string): string {
    if (!raw) return "";
    let url = raw.trim().toLowerCase();
    if (!/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }
    const parsed = URL.parse(url);
    if (!parsed) return "";
    let result = `${parsed.protocol}//${parsed.hostname}${parsed.pathname}${parsed.search}`;
    result = result.replace(/\/$/, "");
    return result;
  }

  protected formatAddress(parts: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  }): string {
    const { street, city = "", state = "", zip = "" } = parts;
    const line1 = street ? `${street}, ` : "";
    return `${line1}${city}, ${state} ${zip}`.trim().replace(/ ,/, ",");
  }

  protected toRecord(
    raw: Partial<RawBusinessRecord>,
    defaults: { category: string; state: string }
  ): RawBusinessRecord {
    return {
      companyName: raw.companyName ?? "",
      firstName: raw.firstName,
      lastName: raw.lastName,
      brokerageName: raw.brokerageName,
      phone: this.normalizePhone(raw.phone ?? ""),
      state: defaults.state.toUpperCase(),
      zipCode: raw.zipCode ?? "",
      city: raw.city ?? "",
      timezone: raw.timezone ?? this.deriveTimezone(defaults.state),
      address: raw.address ?? "",
      category: defaults.category,
      googleMainCategory: raw.googleMainCategory ?? "",
      googleSubcategories: raw.googleSubcategories ?? "",
      website: this.normalizeUrl(raw.website ?? ""),
      rating: typeof raw.rating === "number" ? raw.rating : 0,
      reviewCount: typeof raw.reviewCount === "number" ? raw.reviewCount : 0,
      scrapedAt: raw.scrapedAt ?? new Date().toISOString(),
      googlePlaceId: raw.googlePlaceId ?? "",
      googleMapsLink: raw.googleMapsLink ?? "",
    };
  }
}

// ---------------------------------------------------------------------------
// Discovery Crawler
// ---------------------------------------------------------------------------

export class DiscoveryCrawler {
  private adapter: SourceAdapter;
  private fetcher: ResilientFetcher;
  private concurrency: number;

  constructor(options: {
    adapter: SourceAdapter;
    fetcher: ResilientFetcher;
    concurrency?: number;
  }) {
    this.adapter = options.adapter;
    this.fetcher = options.fetcher;
    this.concurrency = options.concurrency ?? 3;
  }

  async *crawl(
    query: DiscoveryQuery,
    signal?: AbortSignal
  ): AsyncGenerator<CrawlerEvent> {
    const locations = this.expandLocations(query.locations);
    const totalQueries = locations.length;
    let completedQueries = 0;
    let totalRecords = 0;
    const errors: CrawlerErrorEntry[] = [];
    const limit = query.limitPerLocation ?? 50;

    const emitProgress = () => {
      return {
        type: "progress" as const,
        data: {
          totalQueries,
          completedQueries,
          totalRecords,
          errors: [...errors],
        },
      };
    };

    yield emitProgress();

    for (let i = 0; i < locations.length; i += this.concurrency) {
      if (signal?.aborted) break;

      const batch = locations.slice(i, i + this.concurrency);
      const batchResults = await Promise.allSettled(
        batch.map((loc) => this.processLocation(query.category, loc, limit, signal))
      );

      for (const result of batchResults) {
        completedQueries++;

        if (result.status === "fulfilled") {
          for (const event of result.value) {
            if (event.type === "record") {
              totalRecords++;
              yield event;
            } else if (event.type === "error") {
              errors.push(event.data);
              yield event;
            }
          }
        } else {
          const err = result.reason;
          const entry: CrawlerErrorEntry = {
            type: "unknown",
            message: err instanceof Error ? err.message : String(err),
            queryLocation: "",
            category: query.category,
            timestamp: new Date().toISOString(),
          };
          errors.push(entry);
          yield { type: "error", data: entry };
        }

        yield emitProgress();
      }
    }

    yield emitProgress();
  }

  private async processLocation(
    category: string,
    location: LocationSpec,
    limit: number,
    signal?: AbortSignal
  ): Promise<CrawlerEvent[]> {
    const events: CrawlerEvent[] = [];
    const locationLabel = this.locationLabel(location);

    try {
      const stream = this.adapter.search({
        category,
        location,
        limit,
        fetcher: this.fetcher,
        signal,
      });

      for await (const record of stream) {
        events.push({
          type: "record",
          data: {
            record,
            source: this.adapter.source,
            queryLocation: locationLabel,
          },
        });
      }
    } catch (err) {
      const entry = this.classifyError(err, locationLabel, category);
      events.push({ type: "error", data: entry });
    }

    return events;
  }

  private expandLocations(locations: LocationSpec[]): LocationSpec[] {
    const expanded: LocationSpec[] = [];
    for (const loc of locations) {
      const state = loc.state.toUpperCase();
      if (US_STATES[state] && !loc.city && !loc.zipCode) {
        const cities = MAJOR_CITIES[state];
        if (cities && cities.length > 0) {
          for (const city of cities) {
            expanded.push({ city, state });
          }
          continue;
        }
      }
      expanded.push({ ...loc, state });
    }
    return expanded;
  }

  private locationLabel(loc: LocationSpec): string {
    if (loc.city && loc.state) return `${loc.city}, ${loc.state}`;
    if (loc.zipCode && loc.state) return `${loc.zipCode}, ${loc.state}`;
    return loc.state;
  }

  private classifyError(
    err: unknown,
    location: string,
    category: string
  ): CrawlerErrorEntry {
    const msg = err instanceof Error ? err.message : String(err);
    let type: CrawlerErrorType = "unknown";
    if (/429|rate.limit/i.test(msg)) type = "rate_limited";
    else if (/timeout|timed.?out|ETIMEDOUT/i.test(msg)) type = "timeout";
    else if (/ECONNREFUSED|ENOTFOUND|ECONNRESET/i.test(msg)) type = "network";
    else if (/parse|unexpected|syntax|json/i.test(msg)) type = "parse";

    return { type, message: msg, queryLocation: location, category, timestamp: new Date().toISOString() };
  }
}

// ---------------------------------------------------------------------------
// Static query generators
// ---------------------------------------------------------------------------

export function expandStateQueries(
  category: string,
  states: string[],
  limitPerLocation = 50
): DiscoveryQuery[] {
  return states.map((state) => ({
    category,
    locations: [{ state: state.toUpperCase() }],
    limitPerLocation,
  }));
}

export function expandCityQueries(
  category: string,
  locations: LocationSpec[],
  limitPerLocation = 50
): DiscoveryQuery[] {
  return [
    {
      category,
      locations,
      limitPerLocation,
    },
  ];
}