// ─── Root Layout ──────────────────────────────────
// Applies the global styles, font loading, metadata,
// QueryClient provider, ThemeProvider, and Toaster.
// ──────────────────────────────────────────────────

import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { Toaster } from "@fine-leads/ui";
import { OrganizationSchema, WebSiteSchema, SoftwareApplicationSchema } from "@/components/seo";
import "@fine-leads/ui/globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#09090B",
};

export const metadata: Metadata = {
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/favicon.svg", sizes: "180x180", type: "image/svg+xml" },
    ],
    shortcut: ["/favicon.svg"],
  },
  title: {
    default: "LeadsDom - B2B Lead Generation & Scraping Platform",
    template: "%s | LeadsDom - B2B Lead Generation & Scraping Platform",
  },
  description:
    "Access verified data on 2M+ US real estate agents. Search, filter, and export leads by state, brokerage, transaction volume, and more.",
  keywords: [
    "real estate leads",
    "real estate agent data",
    "realtor database",
    "real estate prospecting",
    "US real estate agents",
    "lead generation",
    "B2B real estate",
  ],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://getleadsdom.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "LeadsDom",
    url: "https://getleadsdom.com",
    title: "LeadsDom - B2B Lead Generation & Scraping Platform",
    description:
      "Access verified data on 2M+ US real estate agents. Search, filter, and export leads by state, brokerage, transaction volume, and more.",
    images: [
      {
        url: "https://getleadsdom.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "LeadsDom - B2B Lead Generation Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LeadsDom - B2B Lead Generation & Scraping Platform",
    description:
      "Access verified data on 2M+ US real estate agents. Search, filter, and export leads by state, brokerage, transaction volume, and more.",
    images: ["https://getleadsdom.com/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: "https://getleadsdom.com",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${jakarta.variable} ${jetbrainsMono.variable} overflow-x-hidden`}>
      <body className="min-h-screen w-full max-w-full overflow-x-hidden bg-white text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-50 font-sans">
        <Providers>{children}</Providers>
        <Toaster />
        <OrganizationSchema />
        <WebSiteSchema />
        <SoftwareApplicationSchema />
      </body>
    </html>
  );
}
