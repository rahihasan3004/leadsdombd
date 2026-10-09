import { baseConfig } from "@fine-leads/config/eslint";

export default [
  // actual-evaluated.mjs is a dumped browser-evaluated script, not source.
  { ignores: ["actual-evaluated.mjs"] },
  ...baseConfig,
  {
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];