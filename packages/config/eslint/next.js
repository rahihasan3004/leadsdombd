import { baseConfig } from "./base.js";

export const nextConfig = [
  ...baseConfig,
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];