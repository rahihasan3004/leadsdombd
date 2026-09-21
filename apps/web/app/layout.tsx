// ─── Root Layout ──────────────────────────────────
// Applies the global styles, font loading, metadata,
// QueryClient provider, ThemeProvider, and Toaster.
// ──────────────────────────────────────────────────

import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { Toaster } from "@fine-leads/ui";
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
  title: {
    default: "LeadsDom — Verified US Real Estate Agent Data",
    template: "%s | LeadsDom",
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
    title: "LeadsDom — Verified US Real Estate Agent Data",
    description:
      "Access verified data on 2M+ US real estate agents. Search, filter, and export leads.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${jakarta.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-white text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-50 font-sans">
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}