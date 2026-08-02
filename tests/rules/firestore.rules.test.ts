/**
 * Firestore security rules tests.
 *
 * Runs against the Firestore emulator, NOT the default vitest project — see
 * `pnpm test:rules`. `pnpm test` excludes tests/rules on purpose so the normal
 * unit suite never needs an emulator running.
 *
 * The app is trust-based: PAX are unauthenticated and nearly everything is
 * wide open. These tests exist to pin down the two places that are not —
 * the admin-only fields on /users, and the admin panel's own collections.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, deleteField, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

let testEnv: RulesTestEnvironment

const ADMIN_UID = 'admin-auth-uid'
const NON_ADMIN_UID = 'signed-in-but-not-admin'

/** A realistic PAX doc, minus anything privileged. */
const paxDoc = (overrides: Record<string, unknown> = {}) => ({
  id: 'pax-1',
  displayName: 'Splice',
  regionId: 'bedrock',
  createdAt: '2026-01-01T00:00:00.000Z',
  notificationPreferences: { dailyReminder: true },
  badges: [],
  currentStreak: 0,
  longestStreak: 0,
  ...overrides,
})

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'f3-rules-test',
    firestore: {
      rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      // Must match firebase.json > emulators.firestore.port. 8080 is left
      // alone because it collides with too much other local tooling.
      port: 8181,
    },
  })
})

afterAll(async () => {
  await testEnv?.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

/** Seed a doc bypassing rules, the way the Admin SDK would. */
async function seed(path: [string, string], data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), path[0], path[1]), data)
  })
}

describe('users — unauthenticated PAX (the live app)', () => {
  it('allows creating a normal user doc', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertSucceeds(setDoc(doc(db, 'users', 'pax-1'), paxDoc()))
  })

  it('denies creating a user doc that carries status', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(
      setDoc(doc(db, 'users', 'pax-1'), paxDoc({ status: 'active' }))
    )
  })

  it('denies creating a user doc that carries archivedAt / archivedBy', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(
      setDoc(
        doc(db, 'users', 'pax-1'),
        paxDoc({ archivedAt: '2026-01-01T00:00:00.000Z', archivedBy: 'x' })
      )
    )
  })

  it('denies an update that sets status', async () => {
    await seed(['users', 'pax-1'], paxDoc())
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(
      updateDoc(doc(db, 'users', 'pax-1'), { status: 'archived' })
    )
  })

  it('denies an update that REMOVES status', async () => {
    await seed(['users', 'pax-1'], paxDoc({ status: 'archived' }))
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(
      updateDoc(doc(db, 'users', 'pax-1'), { status: deleteField() })
    )
  })

  it('denies smuggling status in via a merged setDoc', async () => {
    await seed(['users', 'pax-1'], paxDoc())
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(
      setDoc(doc(db, 'users', 'pax-1'), { status: 'archived' }, { merge: true })
    )
  })

  // The rest of this block is the regression net: these are real write paths
  // in the running app and every one of them must keep working.
  it('allows updating displayName', async () => {
    await seed(['users', 'pax-1'], paxDoc())
    const db = testEnv.unauthenticatedContext().firestore()
    await assertSucceeds(
      updateDoc(doc(db, 'users', 'pax-1'), { displayName: 'Bulldozer' })
    )
  })

  it('allows updating fcmTokens', async () => {
    await seed(['users', 'pax-1'], paxDoc())
    const db = testEnv.unauthenticatedContext().firestore()
    await assertSucceeds(
      updateDoc(doc(db, 'users', 'pax-1'), { fcmTokens: ['token-a'] })
    )
  })

  it('allows updating badges, streaks and notificationPreferences', async () => {
    await seed(['users', 'pax-1'], paxDoc())
    const db = testEnv.unauthenticatedContext().firestore()
    await assertSucceeds(
      updateDoc(doc(db, 'users', 'pax-1'), {
        badges: [{ challengeId: 'c1', type: 'completed' }],
        currentStreak: 4,
        longestStreak: 9,
        notificationPreferences: { dailyReminder: false },
      })
    )
  })

  it('allows clearing pendingCelebration with deleteField()', async () => {
    await seed(
      ['users', 'pax-1'],
      paxDoc({ pendingCelebration: { challengeId: 'c1' } })
    )
    const db = testEnv.unauthenticatedContext().firestore()
    await assertSucceeds(
      updateDoc(doc(db, 'users', 'pax-1'), {
        pendingCelebration: deleteField(),
      })
    )
  })

  it('allows a merged upsert on an archived PAX as long as status is untouched', async () => {
    // affectedKeys() is value-based: re-sending the same status is a no-op and
    // must not trip the guard, or an archived PAX's app would hard-fail on any
    // ordinary write.
    await seed(['users', 'pax-1'], paxDoc({ status: 'archived' }))
    const db = testEnv.unauthenticatedContext().firestore()
    await assertSucceeds(
      setDoc(
        doc(db, 'users', 'pax-1'),
        { status: 'archived', currentStreak: 2 },
        { merge: true }
      )
    )
  })

  it('allows reads', async () => {
    await seed(['users', 'pax-1'], paxDoc())
    const db = testEnv.unauthenticatedContext().firestore()
    await assertSucceeds(getDoc(doc(db, 'users', 'pax-1')))
  })
})

describe('users — authenticated admins', () => {
  it('allows an admin to set status', async () => {
    await seed(['admins', ADMIN_UID], { email: 'admin@example.com' })
    await seed(['users', 'pax-1'], paxDoc())
    const db = testEnv.authenticatedContext(ADMIN_UID).firestore()
    await assertSucceeds(
      updateDoc(doc(db, 'users', 'pax-1'), {
        status: 'archived',
        archivedAt: '2026-01-01T00:00:00.000Z',
        archivedBy: ADMIN_UID,
      })
    )
  })

  it('allows an admin to create a user doc carrying status', async () => {
    await seed(['admins', ADMIN_UID], { email: 'admin@example.com' })
    const db = testEnv.authenticatedContext(ADMIN_UID).firestore()
    await assertSucceeds(
      setDoc(doc(db, 'users', 'pax-1'), paxDoc({ status: 'active' }))
    )
  })

  it('denies a signed-in user with no admins/{uid} doc', async () => {
    await seed(['users', 'pax-1'], paxDoc())
    const db = testEnv.authenticatedContext(NON_ADMIN_UID).firestore()
    await assertFails(
      updateDoc(doc(db, 'users', 'pax-1'), { status: 'archived' })
    )
  })

  it('revokes immediately when the admins doc is deleted', async () => {
    await seed(['admins', ADMIN_UID], { email: 'admin@example.com' })
    await seed(['users', 'pax-1'], paxDoc())
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'admins', ADMIN_UID), {})
    })
    const db = testEnv.authenticatedContext(ADMIN_UID).firestore()
    await assertSucceeds(
      updateDoc(doc(db, 'users', 'pax-1'), { status: 'archived' })
    )

    await testEnv.withSecurityRulesDisabled(async ctx => {
      const { deleteDoc } = await import('firebase/firestore')
      await deleteDoc(doc(ctx.firestore(), 'admins', ADMIN_UID))
    })
    await assertFails(
      updateDoc(doc(db, 'users', 'pax-1'), { status: 'active' })
    )
  })
})

describe('admin-only collections are closed to every client', () => {
  const collections = ['admins', 'adminAudit', 'adminBootstrap']

  for (const col of collections) {
    describe(col, () => {
      it('denies unauthenticated read and write', async () => {
        await seed([col, 'doc-1'], { seeded: true })
        const db = testEnv.unauthenticatedContext().firestore()
        await assertFails(getDoc(doc(db, col, 'doc-1')))
        await assertFails(setDoc(doc(db, col, 'doc-2'), { x: 1 }))
      })

      it('denies read and write even for an admin client', async () => {
        await seed(['admins', ADMIN_UID], { email: 'admin@example.com' })
        await seed([col, 'doc-1'], { seeded: true })
        const db = testEnv.authenticatedContext(ADMIN_UID).firestore()
        await assertFails(getDoc(doc(db, col, 'doc-1')))
        await assertFails(setDoc(doc(db, col, 'doc-2'), { x: 1 }))
      })
    })
  }
})

describe('existing collections are untouched', () => {
  it('still allows unauthenticated dailyLogs writes', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertSucceeds(
      setDoc(doc(db, 'dailyLogs', 'log-1'), { userId: 'pax-1', reps: 10 })
    )
  })

  it('still blocks feed hard deletes', async () => {
    await seed(['feed', 'post-1'], { text: 'hi' })
    const db = testEnv.unauthenticatedContext().firestore()
    const { deleteDoc } = await import('firebase/firestore')
    await assertFails(deleteDoc(doc(db, 'feed', 'post-1')))
  })

  it('still blocks notificationLog writes', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(setDoc(doc(db, 'notificationLog', 'n-1'), { x: 1 }))
    expect(true).toBe(true)
  })
})
