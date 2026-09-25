import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const isDev = process.env.NODE_ENV === "development";
const scriptSrc = isDev
  ? "'self' 'unsafe-inline' 'unsafe-eval'"
  : "'self' 'unsafe-inline'";

const connectSrc = isDev
  ? "'self' https: http: ws: wss: localhost:*"
  : "'self' https: *.lemonsqueezy.com";

const nextConfig: NextConfig = {
  env: {
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID || "",
    AUTH_GOOGLE_SECRET:
      process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET || "",
    AUTH_SECRET: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "",
  },
  transpilePackages: ["@fine-leads/ui", "@fine-leads/utils", "@fine-leads/auth", "@fine-leads/database", "recharts"],
  experimental: {
    optimizePackageImports: ["@fine-leads/ui", "lucide-react"],
  },
  serverExternalPackages: ["@prisma/client", "@fine-leads/database", "bcryptjs"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value:
              `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' https://lh3.googleusercontent.com https://avatars.githubusercontent.com data: blob:; font-src 'self' data:; connect-src ${connectSrc}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/pricing",
        destination: "/#faq",
        permanent: true,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  widenClientFileUpload: true,
});
