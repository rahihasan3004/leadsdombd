import { baseConfig } from "@fine-leads/config/eslint";

export default [
  ...baseConfig,
  {
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];