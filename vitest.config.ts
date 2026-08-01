import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Default unit suite (`pnpm test`). tests/rules is excluded because it needs
// the Firestore emulator — see vitest.rules.config.ts / `pnpm test:rules`.
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
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', 'tests/rules/**'],
  },
})
