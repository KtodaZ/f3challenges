import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Admin API route tests. Requires the Firestore emulator — run via
// `pnpm test:api`, which wraps this in `firebase emulators:exec`.
//
// Separate from the default suite (vitest.config.ts) for the same reason
// tests/rules is: `pnpm test` must never need an emulator running.
export default defineConfig({
  resolve: {
    // The routes and admin-auth both import through `@/`.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['tests/api/**/*.test.ts'],
    // The mocked Admin SDK app and the emulator database are shared process
    // state, and every file wipes collections between cases.
    fileParallelism: false,
    setupFiles: ['./tests/api/setup.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
  },
})
