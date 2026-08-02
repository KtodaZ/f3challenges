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
    // Generated / non-TS files
    ".claude-debug/**",
    "functions/lib/**",
    // Agent worktrees are full checkouts nested inside the repo — linting them
    // double-reports every file and fails on paths already ignored above.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
