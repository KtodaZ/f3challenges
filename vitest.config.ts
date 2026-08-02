import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Default unit suite (`pnpm test`). tests/rules and tests/api are excluded
// because they need the Firestore emulator — see vitest.rules.config.ts /
// vitest.api.config.ts, run together by `pnpm test:emulator`.
export default defineConfig({
  resolve: {
    // Mirrors the `@/*` path in tsconfig.json. Without it, any test that
    // reaches into src/ fails to resolve — the suite used to live entirely in
    // shared/, which doesn't use the alias.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      'tests/rules/**',
      'tests/api/**',
      // Agent worktrees are full checkouts nested inside the repo; without this
      // every test runs twice and emulator-dependent suites run unconfigured.
      '.claude/worktrees/**',
    ],
  },
})
