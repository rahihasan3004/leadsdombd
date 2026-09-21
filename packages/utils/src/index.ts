import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  }).format(d);
}

export function formatRelativeDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(d);
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
  { code: "DC", name: "District of Columbia" },
] as const;

export type USState = (typeof US_STATES)[number]["code"];

const STATE_TIMEZONES: Record<string, string> = {
  AL: "CST", AK: "AKST", AZ: "MST", AR: "CST", CA: "PST", CO: "MST", CT: "EST", DE: "EST", FL: "EST",
  GA: "EST", HI: "HST", ID: "MST", IL: "CST", IN: "EST", IA: "CST", KS: "CST", KY: "EST", LA: "CST",
  ME: "EST", MD: "EST", MA: "EST", MI: "EST", MN: "CST", MS: "CST", MO: "CST", MT: "MST", NE: "CST",
  NV: "PST", NH: "EST", NJ: "EST", NM: "MST", NY: "EST", NC: "EST", ND: "CST", OH: "EST", OK: "CST",
  OR: "PST", PA: "EST", RI: "EST", SC: "EST", SD: "CST", TN: "CST", TX: "CST", UT: "MST", VT: "EST",
  VA: "EST", WA: "PST", WV: "EST", WI: "CST", WY: "MST", DC: "EST",
};

export const LEAD_STATES = US_STATES.map((s) => {
  return {
    code: s.code,
    name: s.name,
    count: 0,
    timezone: STATE_TIMEZONES[s.code] ?? "EST",
  };
}) as readonly { code: string; name: string; count: number; timezone: string }[];

export type LeadState = string;

export const PRICE_PER_THOUSAND_LEADS = 19;
export const PRICE_PER_LEAD = 0.019;

export function calculateLeadPrice(leadCount: number): number {
  if (leadCount <= 0) return 0;
  return Math.round(leadCount * PRICE_PER_LEAD * 100) / 100;
}

export function calculateUpgradePrice(
  purchasedStates: string[],
  amountPaidPreviously: number,
): { canUpgrade: boolean; upgradePrice: number } {
  const purchasedCount = purchasedStates.length;
  const totalStates = LEAD_STATES.length;
  if (purchasedCount >= totalStates) {
    return { canUpgrade: false, upgradePrice: 0 };
  }
  return { canUpgrade: true, upgradePrice: 0 };
}

export { generateOrderRef, generateTxnRef } from "./order-ref";