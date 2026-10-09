import js from "@eslint/js";
import eslintPluginOnlyWarn from "eslint-plugin-only-warn";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";

/**
 * Shared flat config. eslint-plugin-only-warn downgrades every rule to a
 * warning, so lint (and the lint step inside `next build`) never fails on
 * style issues — only on parse/config errors.
 */
export const baseConfig = tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/next-env.d.ts",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: { onlyWarn: eslintPluginOnlyWarn },
  },
  {
    plugins: { turbo: turboPlugin },
    rules: {
      "turbo/no-undeclared-env-vars": "off",
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // Plain JS/MJS config files run in Node.
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: { process: "readonly", module: "writable", require: "readonly", __dirname: "readonly", console: "readonly" },
    },
  },
);

export default baseConfig;
