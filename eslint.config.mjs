import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Generated Prisma client - not ours to lint.
    "src/generated/**",

    // One-off CommonJS importers used to seed the catalog from a spreadsheet.
    // Kept for reference; not part of the app or any npm script.
    "scripts/*.js",
    "prisma.config.js",
  ]),
  {
    // Test doubles stand in for Prisma results and are deliberately partial,
    // so `as any` on a mock is the point rather than a lapse.
    files: ["src/__tests__/**/*.ts", "src/__tests__/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);

export default eslintConfig;
