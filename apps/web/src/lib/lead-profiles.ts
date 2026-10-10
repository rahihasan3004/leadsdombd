/** Shared profile allowlist: only customer-visible links, never scraper metadata. */
export const SOCIAL_PROFILE_FIELDS = [
  { key: "linkedin", label: "LinkedIn Profile" },
  { key: "facebook", label: "Facebook Page" },
  { key: "instagram", label: "Instagram" },
  { key: "whatsapp", label: "WhatsApp Contact" },
  { key: "twitter", label: "Twitter / X" },
  { key: "tiktok", label: "TikTok" },
  { key: "youtube", label: "YouTube" },
  { key: "pinterest", label: "Pinterest" },
  { key: "threads", label: "Threads" },
  { key: "telegram", label: "Telegram" },
  { key: "snapchat", label: "Snapchat" },
] as const;
export type SocialProfileKey = (typeof SOCIAL_PROFILE_FIELDS)[number]["key"];
export type SocialProfileLinks = Partial<Record<SocialProfileKey, string>>;
const aliases = new Map<string, SocialProfileKey>();
for (const { key } of SOCIAL_PROFILE_FIELDS)
  for (const suffix of [
    "",
    "url",
    "link",
    "profile",
    "profileurl",
    "profilelink",
    "page",
    "pageurl",
    "pagelink",
    "contact",
    "contacturl",
  ])
    aliases.set(key + suffix, key);
for (const alias of [
  "x",
  "xurl",
  "xprofile",
  "xprofileurl",
  "twitterx",
  "twitterxurl",
])
  aliases.set(alias, "twitter");
const normalizedKey = (key: string) => key.toLowerCase().replace(/[\s_-]/g, "");
export const socialProfileKey = (key: string) =>
  aliases.get(normalizedKey(key));
export const isSocialContainer = (key: string) =>
  [
    "socialprofiles",
    "sociallinks",
    "socials",
    "digitalprofiles",
    "enrichedprofiles",
    "enrichmentprofiles",
  ].includes(normalizedKey(key));
export function safeSocialUrl(value: unknown): string | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const fields = value as Record<string, unknown>;
    value = fields.url ?? fields.href ?? fields.link;
  }
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function normalizeSocialProfiles(
  ...sources: unknown[]
): SocialProfileLinks | null {
  const result: SocialProfileLinks = {};
  for (const source of sources) {
    if (!source || typeof source !== "object" || Array.isArray(source))
      continue;
    for (const [key, value] of Object.entries(source)) {
      const platform = socialProfileKey(key);
      if (!platform) continue;
      const url = safeSocialUrl(value);
      if (url && !result[platform]) result[platform] = url;
    }
  }
  return Object.keys(result).length ? result : null;
}
const socialHosts = [
  "linkedin.com",
  "facebook.com",
  "fb.com",
  "fb.me",
  "instagram.com",
  "twitter.com",
  "x.com",
  "whatsapp.com",
  "wa.me",
  "tiktok.com",
  "youtube.com",
  "youtu.be",
  "pinterest.com",
  "pin.it",
  "threads.net",
  "threads.com",
  "t.me",
  "telegram.me",
  "snapchat.com",
];
export function isSocialProfileUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(
      value.trim().startsWith("www.")
        ? `https://${value.trim()}`
        : value.trim(),
    );
    const host = url.hostname.toLowerCase();
    return socialHosts.some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}
/** Also prevents bonus links leaking through a duplicate Website/business text field. */
export function stripSocialLinks(
  value: string,
  known: SocialProfileLinks | null,
): string {
  let safe = value;
  for (const url of Object.values(known ?? {}))
    safe = safe.split(url).join("").split(encodeURIComponent(url)).join("");
  if (isSocialProfileUrl(safe)) return "";
  return safe
    .replace(/https?:\/\/[^\s"'<>]+/gi, (url) =>
      isSocialProfileUrl(url) ? "" : url,
    )
    .trim();
}
