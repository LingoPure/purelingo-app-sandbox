import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // react-hooks/set-state-in-effect fires on pre-existing setState-in-effect patterns
    // across the app. Downgraded to warn during the portfolio migration — per-repo fixes
    // deferred, but the signal stays visible. (The earlier config referenced a
    // non-existent "react-compiler/react-compiler" rule; this is the rule actually firing.)
    plugins: { "react-hooks": reactHooks },
    rules: { "react-hooks/set-state-in-effect": "warn" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated Playwright report/trace bundles (minified vendor JS — never lint these).
    "tests/e2e/results/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
