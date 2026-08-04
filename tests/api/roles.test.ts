/**
 * GET /api/admin/roles — which PAX carry the ADMIN tag in the feed.
 *
 * Unauthenticated by design (see the route), so the cases worth pinning are
 * about what it *doesn't* say: no emails, no uids, and nothing about admins who
 * were only ever designated.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { adminDb } from '@/lib/firebase-admin'
import { GET } from '@/app/api/admin/roles/route'
import type { AdminRolesResponse } from '@/app/api/admin/roles/route'
import { ADMINS_COLLECTION, DESIGNATIONS_COLLECTION } from '@/lib/admin-auth'
import {
  clearDb, json, seedAdmin, seedUser,
  BEDROCK_UID, SUPER_UID,
} from './harness'

async function roles() {
  return json<AdminRolesResponse>(await GET())
}

beforeEach(async () => {
  await clearDb()
  await seedUser({ id: 'pax-kyle', displayName: 'Babe', regionId: 'bedrock' })
  await seedUser({ id: 'pax-hot', displayName: 'Hot Keys', regionId: 'sactown' })
})

describe('the role map', () => {
  it('reports a linked admin under their PAX id, not their uid', async () => {
    await seedAdmin(SUPER_UID, { role: 'superadmin', regionIds: [], userId: 'pax-kyle' })

    const { roles: map } = await roles()
    expect(map).toEqual({ 'pax-kyle': 'superadmin' })
    // The uid is the admin's identity, not the PAX's — it must not leak.
    expect(Object.keys(map)).not.toContain(SUPER_UID)
  })

  it('keeps the two roles apart', async () => {
    await seedAdmin(SUPER_UID, { role: 'superadmin', regionIds: [], userId: 'pax-kyle' })
    await seedAdmin(BEDROCK_UID, { role: 'regionAdmin', regionIds: ['sactown'], userId: 'pax-hot' })

    expect((await roles()).roles).toEqual({
      'pax-kyle': 'superadmin',
      'pax-hot': 'regionAdmin',
    })
  })

  it('skips an admin who never linked a PAX account', async () => {
    // Nothing in the app bears their name, so there is nothing to tag.
    await seedAdmin(SUPER_UID, { role: 'superadmin', regionIds: [] })

    expect((await roles()).roles).toEqual({})
  })

  it('says nothing about someone merely designated', async () => {
    // A designation is a name on a list until they sign in — no tag yet.
    await adminDb.collection(DESIGNATIONS_COLLECTION).doc('pending').set({
      email: 'later@example.com',
      role: 'regionAdmin',
      regionIds: ['bedrock'],
      userId: 'pax-hot',
      createdAt: '2026-08-01T00:00:00.000Z',
      createdBy: SUPER_UID,
      createdByEmail: 'super@example.com',
    })

    expect((await roles()).roles).toEqual({})
  })

  it('drops the tag as soon as the admin record goes', async () => {
    await seedAdmin(SUPER_UID, { role: 'superadmin', regionIds: [], userId: 'pax-kyle' })
    await adminDb.collection(ADMINS_COLLECTION).doc(SUPER_UID).delete()

    expect((await roles()).roles).toEqual({})
  })

  it('leaks no email or name for the admins it does report', async () => {
    await seedAdmin(SUPER_UID, { role: 'superadmin', regionIds: [], userId: 'pax-kyle' })

    const body = JSON.stringify(await roles())
    expect(body).not.toContain('@example.com')
  })
})

describe('with no admins at all', () => {
  it('answers with an empty map rather than failing', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect((await json<AdminRolesResponse>(res)).roles).toEqual({})
  })
})

// The route takes no request, so there is deliberately no token case here:
// there is nothing to authorize. Everything it returns is derivable from
// `/api/admin/status`, which is already public — see both routes' comments.
