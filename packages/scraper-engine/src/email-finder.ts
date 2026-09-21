import { ResilientFetcher } from "./anti-ban.js";

export type EmailClassification = "personalized" | "generic";

export interface EmailCandidate {
  email: string;
  classification: EmailClassification;
  sourceUrl: string;
  confidence: number;
}

export interface EmailFinderResult {
  bestEmail: EmailCandidate | null;
  candidates: EmailCandidate[];
  totalPagesCrawled: number;
  totalEmailsFound: number;
  zipCode: string;
}

export interface EmailFinderOptions {
  maxDepth?: number;
  maxPages?: number;
  timeoutMs?: number;
}

const HIGH_PROB_CONTACT_PATHS = [
  "/contact",
  "/contact-us",
  "/contact-me",
  "/get-in-touch",
];

const HIGH_PROB_TEAM_PATHS = [
  "/about",
  "/about-us",
  "/our-team",
  "/team",
  "/staff",
  "/leadership",
];

const GENERIC_PREFIXES = new Set([
  "info",
  "contact",
  "support",
  "sales",
  "admin",
  "hello",
  "office",
  "help",
  "service",
  "billing",
  "careers",
  "jobs",
  "media",
  "press",
  "marketing",
  "noreply",
  "no-reply",
  "noreply",
  "donotreply",
  "do-not-reply",
  "webmaster",
  "postmaster",
  "abuse",
  "hostmaster",
]);

const DUMMY_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "wixpress.com",
  "sentry.io",
  "wordpress.org",
  "wordpress.com",
  "yourdomain.com",
  "domain.com",
  "email.com",
  "test.com",
  "mailinator.com",
  "yopmail.com",
  "guerrillamail.com",
  "tempmail.com",
  "10minutemail.com",
  "trashmail.com",
  "fakeinbox.com",
  "moakt.com",
  "dispostable.com",
]);

const MEDIA_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
  "ico",
  "tiff",
  "tif",
  "avif",
  "heic",
  "heif",
  "mp4",
  "mov",
  "avi",
  "mkv",
  "webm",
  "mp3",
  "wav",
  "ogg",
  "flac",
  "css",
  "js",
  "json",
  "xml",
  "woff",
  "woff2",
  "ttf",
  "eot",
  "otf",
]);

const EMAIL_REGEX =
  /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}/g;

const MAILTO_REGEX = /mailto:([^\s"'>?]+)(?:\?[^\s"'>]*)?/gi;

const US_STATE_ABBREV = "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC";

const ZIP_STATE_REGEX = new RegExp(
  `\\b(?:${US_STATE_ABBREV})\\s+(\\d{5})(?:-\\d{4})?\\b`,
  "gi",
);

const ZIP_FALLBACK_REGEX = /\b(\d{5})(?:-\d{4})?\b/g;

const OBFUSCATED_AT_PATTERNS = [
  /\b(\S+)\s*\[at\]\s*(\S+)\s*\[dot\]\s*(\S+)/gi,
  /\b(\S+)\s*\(at\)\s*(\S+)\s*\(dot\)\s*(\S+)/gi,
  /\b(\S+)\s+at\s+(\S+)\s+dot\s+(\S+)/gi,
  /\b(\S+)\s*\[@\]\s*(\S+)\s*\[\.\]\s*(\S+)/gi,
  /\b(\S+)\s*\(@\)\s*(\S+)\s*\(\.\)\s*(\S+)/gi,
  /\b(\S+)\s*&#64;\s*(\S+)\s*&#46;\s*(\S+)/gi,
];

const OBFUSCATED_ENTITY_MAP: Record<string, string> = {
  "&#64;": "@",
  "&#x40;": "@",
  "&#064;": "@",
  "&#46;": ".",
  "&#x2e;": ".",
  "&#046;": ".",
  "&#109;": "m",
  "&#x6d;": "m",
  "&#097;": "a",
  "&#x61;": "a",
  "&#105;": "i",
  "&#x69;": "i",
  "&#108;": "l",
  "&#x6c;": "l",
  "&#116;": "t",
  "&#x74;": "t",
  "&#111;": "o",
  "&#x6f;": "o",
  "&#099;": "c",
  "&#x63;": "c",
  "&#110;": "n",
  "&#x6e;": "n",
  "&#115;": "s",
  "&#x73;": "s",
  "&#101;": "e",
  "&#x65;": "e",
  "&#114;": "r",
  "&#x72;": "r",
  "&#112;": "p",
  "&#x70;": "p",
  "&#098;": "b",
  "&#x62;": "b",
  "&#100;": "d",
  "&#x64;": "d",
  "&#117;": "u",
  "&#x75;": "u",
  "&#103;": "g",
  "&#x67;": "g",
  "&#104;": "h",
  "&#x68;": "h",
  "&#102;": "f",
  "&#x66;": "f",
  "&#119;": "w",
  "&#x77;": "w",
  "&#118;": "v",
  "&#x76;": "v",
  "&#121;": "y",
  "&#x79;": "y",
  "&#122;": "z",
  "&#x7a;": "z",
};

function normalizeUrl(raw: string): string {
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.search = "";
  let hostname = parsed.hostname.toLowerCase();
  hostname = hostname.replace(/^www\./, "");
  return `${parsed.protocol}//${hostname}${parsed.pathname.replace(/\/+$/, "")}`;
}

function getDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function extractDomainFromEmail(email: string): string | null {
  const parts = email.split("@");
  return parts.length === 2 ? parts[1]!.toLowerCase() : null;
}

function isSameDomainOrSubdomain(emailDomain: string, websiteDomain: string): boolean {
  return (
    emailDomain === websiteDomain ||
    emailDomain.endsWith(`.${websiteDomain}`)
  );
}

function isMediaEmail(email: string): boolean {
  const parts = email.split("@");
  if (parts.length !== 2) return true;
  const [local, domain] = parts as [string, string];
  const domainParts = domain.split(".");
  for (const part of domainParts) {
    if (MEDIA_EXTENSIONS.has(part)) return true;
  }
  if (local.includes("@2x") || local.includes("@3x") || local.includes("@1x")) {
    return true;
  }
  return false;
}

function isDummyDomain(email: string): boolean {
  const domain = extractDomainFromEmail(email);
  if (!domain) return true;
  if (DUMMY_DOMAINS.has(domain)) return true;
  for (const dummy of DUMMY_DOMAINS) {
    if (domain.endsWith(`.${dummy}`)) return true;
  }
  return false;
}

function isValidEmailFormat(email: string): boolean {
  if (email.length > 254) return false;
  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts as [string, string];
  if (local.length === 0 || local.length > 64) return false;
  if (domain.length === 0 || domain.length > 255) return false;
  if (local.startsWith(".") || local.endsWith(".")) return false;
  if (local.includes("..")) return false;
  if (domain.startsWith("-") || domain.startsWith(".")) return false;
  if (!/^[a-zA-Z0-9]/.test(local)) return false;
  if (!/[a-zA-Z0-9]$/.test(local)) return false;
  if (domain.includes("..")) return false;
  const domainParts = domain.split(".");
  if (domainParts.length < 2) return false;
  const tld = domainParts[domainParts.length - 1]!;
  if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) return false;
  return true;
}

function isDnsResolvableEmail(email: string): boolean {
  const domain = extractDomainFromEmail(email);
  if (!domain) return false;
  const parts = domain.split(".");
  return parts.length >= 2 && parts.every((p) => p.length > 0 && /^[a-zA-Z0-9-]+$/.test(p));
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#[xX]([0-9a-fA-F]+);?/g, (_, hex) =>
      String.fromCharCode(parseInt(hex as string, 16))
    )
    .replace(/&#(\d+);?/g, (_, dec) =>
      String.fromCharCode(parseInt(dec as string, 10))
    )
    .replace(
      /&(amp|lt|gt|quot|apos|nbsp|#39);/g,
      (match: string): string => {
        switch (match) {
          case "&amp;":
          case "&amp":
            return "&";
          case "&lt;":
          case "&lt":
            return "<";
          case "&gt;":
          case "&gt":
            return ">";
          case "&quot;":
          case "&quot":
            return '"';
          case "&apos;":
          case "&apos":
          case "&#39;":
          case "&#39":
            return "'";
          case "&nbsp;":
          case "&nbsp":
            return " ";
          default:
            return match;
        }
      }
    );
}

function decodeAntiObfuscation(text: string): string {
  let decoded = text;
  for (const [entity, char] of Object.entries(OBFUSCATED_ENTITY_MAP)) {
    decoded = decoded.replace(new RegExp(entity.replace(/[#&;]/g, "\\$&"), "gi"), char);
  }
  for (const pattern of OBFUSCATED_AT_PATTERNS) {
    decoded = decoded.replace(pattern, "$1@$2.$3");
  }
  decoded = decoded.replace(/\s*\[at\]\s*/gi, "@");
  decoded = decoded.replace(/\s*\[dot\]\s*/gi, ".");
  decoded = decoded.replace(/\s*\(at\)\s*/gi, "@");
  decoded = decoded.replace(/\s*\(dot\)\s*/gi, ".");
  return decoded;
}

function classifyEmail(email: string): EmailClassification {
  const localPart = email.split("@")[0]!.toLowerCase();
  if (GENERIC_PREFIXES.has(localPart)) return "generic";
  if (
    /^(info|contact|support|sales|admin|hello|office|help|service|billing|careers|jobs|media|press|marketing|noreply|no.reply|donotreply|do.not.reply|webmaster|postmaster|abuse|hostmaster)(\d+|[-_])/i.test(
      localPart
    )
  ) {
    return "generic";
  }
  return "personalized";
}

function calculateConfidence(
  email: string,
  classification: EmailClassification,
  websiteDomain: string,
  foundOnContactPage: boolean,
  foundOnMultiplePages: boolean
): number {
  let confidence = 0;
  const emailDomain = extractDomainFromEmail(email);
  if (emailDomain && isSameDomainOrSubdomain(emailDomain, websiteDomain)) {
    confidence += 40;
  }
  if (classification === "personalized") {
    confidence += 30;
  } else {
    confidence += 10;
  }
  if (foundOnContactPage) {
    confidence += 20;
  }
  if (foundOnMultiplePages) {
    confidence += 10;
  }
  return Math.min(confidence, 100);
}

function extractEmailsFromText(text: string): string[] {
  const emails = new Set<string>();
  const decoded = decodeAntiObfuscation(decodeHtmlEntities(text));
  const matches = decoded.matchAll(EMAIL_REGEX);
  for (const match of matches) {
    emails.add(match[0].toLowerCase());
  }
  return [...emails];
}

function extractMailtoLinks(html: string): string[] {
  const emails = new Set<string>();
  const decoded = decodeAntiObfuscation(decodeHtmlEntities(html));
  const matches = decoded.matchAll(MAILTO_REGEX);
  for (const match of matches) {
    const rawEmail = match[1]!.toLowerCase().trim();
    const emailMatch = rawEmail.match(EMAIL_REGEX);
    if (emailMatch) {
      emails.add(emailMatch[0]);
    }
  }
  return [...emails];
}

function extractLinks(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  const linkRegex = /<a\s[^>]*href=["']([^"']+)["'][^>]*>/gi;
  const matches = html.matchAll(linkRegex);
  const baseDomain = getDomain(baseUrl);
  for (const match of matches) {
    const href = match[1]!.trim();
    if (
      href.startsWith("#") ||
      href.startsWith("javascript:") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("sms:")
    ) {
      continue;
    }
    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.protocol !== "http:" && resolved.protocol !== "https:") continue;
      const linkDomain = resolved.hostname.toLowerCase();
      if (
        linkDomain === baseDomain ||
        linkDomain.endsWith(`.${baseDomain}`)
      ) {
        resolved.hash = "";
        resolved.search = "";
        links.add(resolved.toString().replace(/\/+$/, ""));
      }
    } catch {
      continue;
    }
  }
  return [...links];
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isContactPage(url: string): boolean {
  const path = new URL(url).pathname.toLowerCase();
  return (
    path === "/contact" ||
    path === "/contact-us" ||
    path === "/contact-me" ||
    path === "/get-in-touch" ||
    path.startsWith("/contact") ||
    path.startsWith("/get-in-touch")
  );
}

export class EmailFinder {
  private fetcher: ResilientFetcher;
  private defaultMaxDepth: number;
  private defaultMaxPages: number;
  private defaultTimeout: number;

  constructor(fetcher: ResilientFetcher, options?: EmailFinderOptions) {
    this.fetcher = fetcher;
    this.defaultMaxDepth = options?.maxDepth ?? 1;
    this.defaultMaxPages = options?.maxPages ?? 5;
    this.defaultTimeout = options?.timeoutMs ?? 30000;
  }

  async findEmails(
    websiteUrl: string,
    options?: EmailFinderOptions
  ): Promise<EmailFinderResult> {
    const maxDepth = options?.maxDepth ?? this.defaultMaxDepth;
    const maxPages = options?.maxPages ?? this.defaultMaxPages;
    const timeout = options?.timeoutMs ?? this.defaultTimeout;

    const normalizedUrl = normalizeUrl(websiteUrl);
    const websiteDomain = getDomain(normalizedUrl);

    const crawlQueue: Array<{ url: string; depth: number }> = [];
    const visited = new Set<string>();
    const foundEmails = new Map<string, { email: string; sourceUrl: string; isContactPage: boolean }>();
    const emailSourceCounts = new Map<string, number>();
    let pagesCrawled = 0;
    let extractedZipCode = "";

    const recordEmail = (email: string, url: string, contactPage: boolean) => {
      emailSourceCounts.set(email, (emailSourceCounts.get(email) ?? 0) + 1);
      if (!foundEmails.has(email)) {
        foundEmails.set(email, { email, sourceUrl: url, isContactPage: contactPage });
      } else if (contactPage) {
        foundEmails.set(email, { email, sourceUrl: url, isContactPage: true });
      }
    };

    const addToQueue = (url: string, depth: number) => {
      const normalized = normalizeUrl(url);
      const linkDomain = getDomain(normalized);
      if (
        (linkDomain === websiteDomain ||
          linkDomain.endsWith(`.${websiteDomain}`)) &&
        !visited.has(normalized) &&
        depth <= maxDepth &&
        crawlQueue.length + visited.size < maxPages * 2
      ) {
        crawlQueue.push({ url: normalized, depth });
      }
    };

    addToQueue(normalizedUrl, 0);
    for (const path of HIGH_PROB_CONTACT_PATHS) {
      addToQueue(`${normalizedUrl}${path}`, 0);
    }
    for (const path of HIGH_PROB_TEAM_PATHS) {
      addToQueue(`${normalizedUrl}${path}`, 0);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      while (crawlQueue.length > 0 && pagesCrawled < maxPages) {
        const batchSize = Math.min(2, crawlQueue.length, maxPages - pagesCrawled);
        const batch = crawlQueue.splice(0, batchSize);
        const urls = batch.map((b) => b.url);

        const results = await Promise.allSettled(
          urls.map(async (url) => {
            if (visited.has(url)) return;
            visited.add(url);
            const response = await this.fetcher.fetch({
              url,
              method: "GET",
              timeout: Math.min(timeout, 15000),
              signal: controller.signal,
            });
            if (!response.ok) return;
            const html = await response.text();
            const contactPage = isContactPage(url);

            const textEmails = extractEmailsFromText(html);
            for (const email of textEmails) {
              recordEmail(email, url, contactPage);
            }

            const mailtoEmails = extractMailtoLinks(html);
            for (const email of mailtoEmails) {
              recordEmail(email, url, contactPage);
            }

            const bodyText = stripHtmlTags(html).toLowerCase();
            const footerEmails = this.extractFooterEmails(bodyText);
            for (const email of footerEmails) {
              recordEmail(email, url, contactPage);
            }

            if (!extractedZipCode) {
              extractedZipCode = this.extractZipCode(html, bodyText);
            }

            if (maxDepth > 0) {
              const links = extractLinks(html, url);
              for (const link of links) {
                addToQueue(link, 1);
              }
            }
          })
        );

        pagesCrawled += results.length;
        for (const result of results) {
          if (result.status === "rejected") {
            const err = result.reason as Error;
            if (err.name === "AbortError") break;
          }
        }

        if (controller.signal.aborted) break;
      }
    } finally {
      clearTimeout(timer);
    }

    const candidates = this.buildCandidates(foundEmails, emailSourceCounts, websiteDomain);
    return {
      bestEmail: candidates.length > 0 ? candidates[0]! : null,
      candidates,
      totalPagesCrawled: pagesCrawled,
      totalEmailsFound: candidates.length,
      zipCode: extractedZipCode,
    };
  }

  private extractFooterEmails(bodyText: string): string[] {
    const emails = new Set<string>();
    const lines = bodyText.split(/\n/);
    const totalLines = lines.length;
    const footerStart = Math.floor(totalLines * 0.7);
    const footerLines = lines.slice(footerStart);
    const footerText = footerLines.join("\n");
    const textEmails = extractEmailsFromText(footerText);
    for (const email of textEmails) {
      emails.add(email);
    }
    return [...emails];
  }

  private extractZipCode(html: string, bodyText: string): string {
    const combined = bodyText || stripHtmlTags(html);

    ZIP_STATE_REGEX.lastIndex = 0;
    const stateMatch = ZIP_STATE_REGEX.exec(combined);
    if (stateMatch?.[1]) return stateMatch[1];

    const footerStart = Math.floor(combined.split(/\n/).length * 0.7);
    const footerText = combined.split(/\n/).slice(footerStart).join("\n");

    ZIP_FALLBACK_REGEX.lastIndex = 0;
    const footerMatch = ZIP_FALLBACK_REGEX.exec(footerText);
    if (footerMatch?.[1]) return footerMatch[1];

    return "";
  }

  private buildCandidates(
    foundEmails: Map<string, { email: string; sourceUrl: string; isContactPage: boolean }>,
    emailSourceCounts: Map<string, number>,
    websiteDomain: string
  ): EmailCandidate[] {
    const filtered = new Map<string, { email: string; sourceUrl: string; isContactPage: boolean }>();
    for (const [email, entry] of foundEmails) {
      if (isMediaEmail(email)) continue;
      if (isDummyDomain(email)) continue;
      if (!isValidEmailFormat(email)) continue;
      if (!isDnsResolvableEmail(email)) continue;
      filtered.set(email, entry);
    }

    const candidates: EmailCandidate[] = [];
    for (const [, entry] of filtered) {
      const classification = classifyEmail(entry.email);
      const foundOnMultiplePages = (emailSourceCounts.get(entry.email) ?? 0) > 1;
      const confidence = calculateConfidence(
        entry.email,
        classification,
        websiteDomain,
        entry.isContactPage,
        foundOnMultiplePages
      );
      candidates.push({
        email: entry.email,
        classification,
        sourceUrl: entry.sourceUrl,
        confidence,
      });
    }

    candidates.sort((a, b) => b.confidence - a.confidence || a.email.localeCompare(b.email));
    return candidates;
  }
}