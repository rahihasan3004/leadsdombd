import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@fine-leads/ui", "@fine-leads/utils", "@fine-leads/auth", "@fine-leads/database"],
  experimental: {
    optimizePackageImports: ["@fine-leads/ui", "lucide-react"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  async redirects() {
    return [
      {
        source: '/pricing',
        destination: '/#faq',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;