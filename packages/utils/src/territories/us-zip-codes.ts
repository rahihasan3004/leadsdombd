import { US_STATES, type USState } from "../index";
import source from "./us-zip-codes.data.json";

/** MIT-licensed geographic snapshot, not a live USPS deliverability/inventory feed.
 * Import through the explicit territories subpath; do not add this dataset to the client utility barrel.
 * Primary metros below are planning anchors, not official Census MSA boundaries.
 */
export interface ZipCity {
  readonly name: string;
  readonly zipCodes: readonly string[];
}
export interface ZipMetro {
  readonly name: string;
  readonly cities: readonly ZipCity[];
}
export interface ZipTerritory {
  readonly code: USState;
  readonly name: string;
  readonly primaryMetros: readonly ZipMetro[];
  readonly cities: readonly ZipCity[];
}
const metroAnchors: Readonly<Record<USState, readonly string[]>> = {
  AL: ["Birmingham", "Huntsville", "Mobile", "Montgomery"],
  AK: ["Anchorage", "Fairbanks", "Juneau"],
  AZ: ["Phoenix", "Tucson", "Mesa"],
  AR: ["Little Rock", "Fayetteville", "Fort Smith"],
  CA: ["Los Angeles", "San Francisco", "San Diego", "Sacramento", "San Jose"],
  CO: ["Denver", "Colorado Springs", "Fort Collins"],
  CT: ["Bridgeport", "Hartford", "New Haven"],
  DE: ["Wilmington", "Dover"],
  FL: ["Miami", "Orlando", "Tampa", "Jacksonville"],
  GA: ["Atlanta", "Augusta", "Savannah"],
  HI: ["Honolulu", "Hilo", "Kahului"],
  ID: ["Boise", "Idaho Falls", "Pocatello"],
  IL: ["Chicago", "Rockford", "Springfield"],
  IN: ["Indianapolis", "Fort Wayne", "South Bend"],
  IA: ["Des Moines", "Cedar Rapids", "Davenport"],
  KS: ["Wichita", "Topeka", "Kansas City"],
  KY: ["Louisville", "Lexington", "Bowling Green"],
  LA: ["New Orleans", "Baton Rouge", "Shreveport"],
  ME: ["Portland", "Bangor", "Lewiston"],
  MD: ["Baltimore", "Rockville", "Frederick"],
  MA: ["Boston", "Worcester", "Springfield"],
  MI: ["Detroit", "Grand Rapids", "Lansing"],
  MN: ["Minneapolis", "Saint Paul", "Rochester"],
  MS: ["Jackson", "Gulfport", "Hattiesburg"],
  MO: ["Saint Louis", "Kansas City", "Springfield"],
  MT: ["Billings", "Missoula", "Great Falls"],
  NE: ["Omaha", "Lincoln", "Grand Island"],
  NV: ["Las Vegas", "Reno", "Carson City"],
  NH: ["Manchester", "Nashua", "Concord"],
  NJ: ["Newark", "Jersey City", "Trenton"],
  NM: ["Albuquerque", "Santa Fe", "Las Cruces"],
  NY: ["New York", "Buffalo", "Rochester", "Albany"],
  NC: ["Charlotte", "Raleigh", "Greensboro"],
  ND: ["Fargo", "Bismarck", "Grand Forks"],
  OH: ["Columbus", "Cleveland", "Cincinnati"],
  OK: ["Oklahoma City", "Tulsa", "Norman"],
  OR: ["Portland", "Salem", "Eugene"],
  PA: ["Philadelphia", "Pittsburgh", "Harrisburg"],
  RI: ["Providence", "Warwick", "Newport"],
  SC: ["Columbia", "Charleston", "Greenville"],
  SD: ["Sioux Falls", "Rapid City", "Aberdeen"],
  TN: ["Nashville", "Memphis", "Knoxville"],
  TX: ["Houston", "Dallas", "Austin", "San Antonio", "Fort Worth"],
  UT: ["Salt Lake City", "Ogden", "Provo"],
  VT: ["Burlington", "Rutland", "Montpelier"],
  VA: ["Virginia Beach", "Richmond", "Arlington"],
  WA: ["Seattle", "Spokane", "Tacoma"],
  WV: ["Charleston", "Huntington", "Morgantown"],
  WI: ["Milwaukee", "Madison", "Green Bay"],
  WY: ["Cheyenne", "Casper", "Laramie"],
  DC: ["Washington"],
};
const compact: Readonly<Record<string, Readonly<Record<string, string>>>> =
  source;
export const US_ZIP_CODE_REGISTRY: Readonly<Record<USState, ZipTerritory>> =
  Object.freeze(
    Object.fromEntries(
      US_STATES.map(({ code, name }) => {
        const cities = Object.entries(compact[code] ?? {}).map(([name, zips]) =>
          Object.freeze({ name, zipCodes: Object.freeze(zips.split(",")) }),
        );
        const byName = new Map(
          cities.map((city) => [city.name.toLowerCase(), city]),
        );
        const primaryMetros = metroAnchors[code].flatMap((anchor) => {
          const city = byName.get(anchor.toLowerCase());
          return city
            ? [
                Object.freeze({
                  name: `${anchor} metro`,
                  cities: Object.freeze([city]),
                }),
              ]
            : [];
        });
        return [
          code,
          Object.freeze({
            code,
            name,
            cities: Object.freeze(cities),
            primaryMetros: Object.freeze(primaryMetros),
          }),
        ];
      }),
    ) as Record<USState, ZipTerritory>,
  );
const ordered = new Map<USState, readonly string[]>();
function normalizedState(stateCode: string): USState | undefined {
  const code = stateCode.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) && Object.hasOwn(US_ZIP_CODE_REGISTRY, code)
    ? (code as USState)
    : undefined;
}
/** Deterministic metro-first, city-interleaved order prevents all initial tasks targeting one city. Returns a defensive copy. */
export function getZipCodesForState(stateCode: string): string[] {
  const code = normalizedState(stateCode);
  if (!code) return [];
  let zips = ordered.get(code);
  if (!zips) {
    const territory = US_ZIP_CODE_REGISTRY[code];
    const anchors = territory.primaryMetros.flatMap((metro) => metro.cities);
    const priority = new Set(anchors.map((city) => city.name));
    const cities = [
      ...anchors,
      ...territory.cities
        .filter((city) => !priority.has(city.name))
        .sort(
          (a, b) =>
            b.zipCodes.length - a.zipCodes.length ||
            a.name.localeCompare(b.name),
        ),
    ];
    const result: string[] = [];
    const seen = new Set<string>();
    const longest = Math.max(0, ...cities.map((city) => city.zipCodes.length));
    for (let offset = 0; offset < longest; offset++)
      for (const city of cities) {
        const zip = city.zipCodes[offset];
        if (zip && !seen.has(zip)) {
          seen.add(zip);
          result.push(zip);
        }
      }
    zips = Object.freeze(result);
    ordered.set(code, zips);
  }
  return [...zips];
}
/** Returns at most count distinct unused ZIPs. Exhaustion never wraps or invents postal codes.
 * This is a pure selector, not a global reservation. Persist selected ZIPs under a job lease/DB uniqueness guard.
 */
export function getNextAvailableZips(
  stateCode: string,
  count: number,
  excludeZips: string[] = [],
): string[] {
  if (!Number.isSafeInteger(count) || count < 0)
    throw new RangeError("ZIP count must be a non-negative safe integer");
  if (!count) return [];
  const excluded = new Set(excludeZips.map((zip) => zip.trim()));
  const result: string[] = [];
  for (const zip of getZipCodesForState(stateCode)) {
    if (!excluded.has(zip)) result.push(zip);
    if (result.length === count) break;
  }
  return result;
}
