import { defineConfig } from 'vitest/config'

// Firestore rules tests only. Requires the Firestore emulator — run via
// `pnpm test:rules`, which wraps this in `firebase emulators:exec`.
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.ts'],
    // Rules tests share one emulator instance and clearFirestore() between
    // cases, so they must not run concurrently.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
})
