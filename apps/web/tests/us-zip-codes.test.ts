import { describe, expect, it } from "vitest";
import { US_STATES } from "@fine-leads/utils";
import {
  US_ZIP_CODE_REGISTRY,
  getZipCodesForState,
  getNextAvailableZips,
} from "@fine-leads/utils/territories/us-zip-codes";
describe("shared US ZIP master registry", () => {
  it.each(US_STATES)(
    "covers $name with cities, metro anchors and five-digit postal codes",
    ({ code, name }) => {
      const territory = US_ZIP_CODE_REGISTRY[code];
      expect(territory.name).toBe(name);
      expect(territory.cities.length).toBeGreaterThan(0);
      expect(territory.primaryMetros.length).toBeGreaterThan(0);
      const zips = getZipCodesForState(code);
      expect(zips.length).toBeGreaterThan(0);
      expect(zips.every((zip) => /^\d{5}$/.test(zip))).toBe(true);
      expect(new Set(zips).size).toBe(zips.length);
      expect(
        new Set(territory.cities.flatMap((city) => city.zipCodes)),
      ).toEqual(new Set(zips));
    },
  );
  it("preserves all 42,366 licensed source ZIP entries across 50 states and DC", () => {
    const all = US_STATES.flatMap((state) => getZipCodesForState(state.code));
    expect(all).toHaveLength(42_366);
    expect(new Set(all).size).toBe(42_366);
    expect(US_STATES.filter((state) => state.code !== "DC")).toHaveLength(50);
  });
  it("includes major city/postal associations without fabricating metro boundaries", () => {
    const austin = US_ZIP_CODE_REGISTRY.TX.cities.find(
      (city) => city.name === "Austin",
    )!;
    expect(austin.zipCodes).toContain("78701");
    expect(
      US_ZIP_CODE_REGISTRY.TX.primaryMetros.some((metro) =>
        metro.cities.includes(austin),
      ),
    ).toBe(true);
    const boston = US_ZIP_CODE_REGISTRY.MA.cities.find(
      (city) => city.name === "Boston",
    )!;
    expect(boston.zipCodes).toContain("02108");
  });
  it("accepts trimmed lowercase states and excludes every previous task ZIP", () => {
    const first = getNextAvailableZips(" tx ", 50);
    const second = getNextAvailableZips("TX", 50, first);
    expect(first).toHaveLength(50);
    expect(second).toHaveLength(50);
    expect(second.every((zip) => !first.includes(zip))).toBe(true);
    expect(new Set([...first, ...second]).size).toBe(100);
  });
  it("never wraps to used ZIPs when a state's registry is exhausted", () => {
    const all = getZipCodesForState("DE");
    expect(getNextAvailableZips("DE", 50, all)).toEqual([]);
    expect(getNextAvailableZips("DE", 50, all.slice(0, -2))).toHaveLength(2);
  });
  it("returns defensive copies, not a shared mutable ordering", () => {
    const first = getZipCodesForState("MA");
    first.splice(0, first.length);
    expect(getZipCodesForState("MA")).toHaveLength(716);
    expect(Object.isFrozen(US_ZIP_CODE_REGISTRY.MA.cities[0]!.zipCodes)).toBe(
      true,
    );
  });
  it("uses deterministic geographic diversity across successive metro anchors", () => {
    const first = getNextAvailableZips("TX", 5);
    const anchors = US_ZIP_CODE_REGISTRY.TX.primaryMetros;
    expect(first).toEqual(anchors.map((metro) => metro.cities[0]!.zipCodes[0]));
    expect(getNextAvailableZips("TX", 5)).toEqual(first);
  });
  it("rejects malformed counts and safely handles unknown states", () => {
    for (const count of [-1, 1.5, NaN, Infinity])
      expect(() => getNextAvailableZips("TX", count)).toThrow(RangeError);
    expect(getZipCodesForState("ZZ")).toEqual([]);
    expect(getZipCodesForState("constructor")).toEqual([]);
    expect(getNextAvailableZips("", 50)).toEqual([]);
    expect(getNextAvailableZips("TX", 0)).toEqual([]);
  });
});
