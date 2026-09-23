import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://getleadsdom.com";

  const publicPages = [
    { url: baseUrl, lastModified: new Date("2025-09-23"), changeFrequency: "daily" as const, priority: 1 },
    { url: `${baseUrl}/contact`, lastModified: new Date("2025-09-23"), changeFrequency: "monthly" as const, priority: 0.6 },
    { url: `${baseUrl}/privacy`, lastModified: new Date("2025-09-23"), changeFrequency: "monthly" as const, priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: new Date("2025-09-23"), changeFrequency: "monthly" as const, priority: 0.3 },
    { url: `${baseUrl}/refund`, lastModified: new Date("2025-09-23"), changeFrequency: "monthly" as const, priority: 0.3 },
    { url: `${baseUrl}/login`, lastModified: new Date("2025-09-23"), changeFrequency: "monthly" as const, priority: 0.5 },
    { url: `${baseUrl}/register`, lastModified: new Date("2025-09-23"), changeFrequency: "monthly" as const, priority: 0.7 },
    { url: `${baseUrl}/forgot-password`, lastModified: new Date("2025-09-23"), changeFrequency: "monthly" as const, priority: 0.4 },
  ];

  return publicPages;
}
