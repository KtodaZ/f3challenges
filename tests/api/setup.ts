/**
 * Swaps `@/lib/firebase-admin` for an emulator-backed Admin SDK.
 *
 * Two halves, deliberately different:
 *
 * - **Firestore is real.** It's the actual `firebase-admin` Firestore client
 *   pointed at the emulator, so transactions, batches, `FieldValue.delete()`
 *   and query conflict sets all behave exactly as they do in production. The
 *   bugs these tests exist to catch (rename uniqueness, single-use invites,
 *   last-superadmin) live in that machinery; a mocked `runTransaction` would
 *   assert nothing about it.
 * - **Auth is stubbed.** `verifyIdToken` is the one boundary a test can't
 *   stand up — it needs Google's signing keys. `asAdmin()` in ./harness drives
 *   it. Everything downstream of the decoded token is real code.
 *
 * Lives in setupFiles rather than each test file so the mock registers once
 * for the whole project; `vi.mock` calls here apply to every test file.
 */
import { vi } from 'vitest'

// The Admin SDK reads this at init. `firebase emulators:exec` sets it, but
// pin it so an accidental bare `vitest run` can't reach a real project.
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8181'
process.env.GOOGLE_CLOUD_PROJECT = 'f3-api-test'

vi.mock('@/lib/firebase-admin', async () => {
  const { getApps, initializeApp } = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')

  const NAME = 'api-tests'
  const app =
    getApps().find(a => a.name === NAME) ??
    initializeApp({ projectId: 'f3-api-test' }, NAME)
  const db = getFirestore(app)

  return {
    adminDb: db,
    adminAuth: { verifyIdToken: vi.fn() },
    // Nothing under /api/admin sends a push; present so the module shape
    // matches and an accidental import doesn't fail to resolve.
    adminMessaging: {},
    getAdminDb: () => db,
    getAdminAuth: () => ({ verifyIdToken: vi.fn() }),
    getAdminMessaging: () => ({}),
  }
})
