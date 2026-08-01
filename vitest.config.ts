import { defineConfig } from 'vitest/config'

// Default unit suite (`pnpm test`). tests/rules is excluded because it needs
// the Firestore emulator — see vitest.rules.config.ts / `pnpm test:rules`.
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', 'tests/rules/**'],
  },
})
