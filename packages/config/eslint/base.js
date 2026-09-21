import js from "@eslint/js";
import eslintPluginOnlyWarn from "eslint-plugin-only-warn";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";

export const baseConfig = tseslint.config(
  { ignores: ["dist/**", "node_modules/**", ".next/**"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: { onlyWarn: eslintPluginOnlyWarn },
  },
  {
    plugins: { turbo: turboPlugin },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
);