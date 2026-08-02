/**
 * GET /api/admin/admins and DELETE /api/admin/admins/[uid], plus the session
 * endpoint that decides whether anyone gets in at all.
 *
 * Revocation is the one operation that can lock everybody out permanently:
 * bootstrap is closed by a durable marker, so an empty `admins` collection has
 * no recovery short of editing Firestore by hand.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { GET as listAdmins } from '@/app/api/admin/admins/route'
import { DELETE as revokeAdmin } from '@/app/api/admin/admins/[uid]/route'
import { POST as session } from '@/app/api/admin/session/route'
import { adminDb } from '@/lib/firebase-admin'
import { ADMINS_COLLECTION, BOOTSTRAP_DOC, type AdminRecord } from '@/lib/admin-auth'
import {
  asCaller, auditEntries, clearDb, ctx, getAdminDoc, json, noValidTokens, req,
  seedAdmin, seedAdmins,
  BEDROCK_UID, SACTOWN_UID, STRANGER_UID, SUPER_UID,
} from './harness'

function revoke(callerToken: string, uid: string) {
  return revokeAdmin(
    req('DELETE', `/api/admin/admins/${uid}`, { token: callerToken }),
    ctx({ uid })
  )
}

async function superadminCount(): Promise<number> {
  const snap = await adminDb.collection(ADMINS_COLLECTION).where('role', '==', 'superadmin').get()
  return snap.size
}

beforeEach(async () => {
  await clearDb()
  await seedAdmins()
})

describe('GET /api/admin/admins', () => {
  it('lists everyone, superadmins first, and flags the caller', async () => {
    const res = await listAdmins(req('GET', '/api/admin/admins', { token: asCaller(SUPER_UID) }))
    const { admins } = await json<{ admins: { uid: string; role: string; isSelf: boolean }[] }>(res)

    expect(admins).toHaveLength(3)
    expect(admins[0].role).toBe('superadmin')
    expect(admins.filter(a => a.isSelf).map(a => a.uid)).toEqual([SUPER_UID])
  })
})

// ── 10: revocation guards ────────────────────────────────────────────────────

describe('DELETE /api/admin/admins/[uid]', () => {
  it('revokes a region admin, effective on their very next request', async () => {
    const res = await revoke(asCaller(SUPER_UID), BEDROCK_UID)
    expect(res.status).toBe(200)
    expect(await getAdminDoc(BEDROCK_UID)).toBeUndefined()

    // Authorization reads admins/{uid} on every call — no token to wait out.
    // This is the whole reason roles aren't Firebase custom claims.
    const after = await listAdmins(req('GET', '/api/admin/admins', { token: asCaller(BEDROCK_UID) }))
    expect(after.status).toBe(403)
  })

  it('refuses revoking yourself', async () => {
    // How you end up locked out of your own panel with nobody able to let you
    // back in.
    const res = await revoke(asCaller(SUPER_UID), SUPER_UID)
    expect(res.status).toBe(409)
    expect(await json<{ error: string }>(res)).toEqual({
      error: "You can't revoke your own access",
    })
    expect(await getAdminDoc(SUPER_UID)).toBeDefined()
  })

  it('never empties the superadmin set, whatever order revocations arrive in', async () => {
    // The invariant the "only superadmin" guard exists to protect, asserted
    // directly rather than through the guard.
    //
    // Worth knowing: that 409 branch is unreachable through this route as
    // written, and the two rules above are why. `assertSuperadmin` means the
    // caller is a superadmin; the self-revoke check means the target is
    // somebody else. So whenever the target's role is `superadmin`, the
    // caller's own record is a second one and the `supers.size <= 1` count
    // cannot hold. The guard is there for the concurrent case its comment
    // describes — two superadmins revoking each other in overlapping requests,
    // where the transaction re-reads and one of them loses. Nothing a single
    // sequential request can reproduce, so this asserts the outcome instead.
    const token = asCaller(SUPER_UID)
    await revoke(token, BEDROCK_UID)
    await revoke(token, SACTOWN_UID)
    await revoke(token, SUPER_UID)

    expect(await superadminCount()).toBe(1)
  })

  it('lets one superadmin revoke another when more than one exists', async () => {
    await seedAdmin('uid-super-2', { role: 'superadmin', regionIds: [] })

    const res = await revoke(asCaller(SUPER_UID), 'uid-super-2')
    expect(res.status).toBe(200)
    expect(await superadminCount()).toBe(1)
  })

  it('404s on an unknown admin', async () => {
    const res = await revoke(asCaller(SUPER_UID), 'uid-nobody')
    expect(res.status).toBe(404)
  })

  it('refuses a region admin outright', async () => {
    const res = await revoke(asCaller(BEDROCK_UID), SACTOWN_UID)
    expect(res.status).toBe(403)
    expect(await getAdminDoc(SACTOWN_UID)).toBeDefined()
  })

  it('audits a revocation with the whole record it removed', async () => {
    await revoke(asCaller(SUPER_UID), BEDROCK_UID)

    const [entry] = await auditEntries('admin.revoke')
    expect(entry).toMatchObject({
      actorUid: SUPER_UID,
      targetType: 'admin',
      targetId: BEDROCK_UID,
    })
    expect(entry.before).toMatchObject({ role: 'regionAdmin', regionIds: ['bedrock'] })
  })

  it('writes nothing when the revocation is refused', async () => {
    await revoke(asCaller(SUPER_UID), SUPER_UID)
    await revoke(asCaller(BEDROCK_UID), SACTOWN_UID)
    await revoke(asCaller(SUPER_UID), 'uid-nobody')

    expect(await auditEntries()).toHaveLength(0)
  })
})

// ── session / bootstrap ──────────────────────────────────────────────────────

describe('POST /api/admin/session', () => {
  it('returns an existing admin their record', async () => {
    const res = await session(req('POST', '/api/admin/session', { token: asCaller(BEDROCK_UID) }))
    expect(res.status).toBe(200)

    expect(await json<{ uid: string; record: AdminRecord }>(res)).toMatchObject({
      uid: BEDROCK_UID,
      record: { role: 'regionAdmin', regionIds: ['bedrock'] },
    })
  })

  it('401s without a token', async () => {
    noValidTokens()
    const res = await session(req('POST', '/api/admin/session', { token: 'nope' }))
    expect(res.status).toBe(401)
  })

  it('403s a signed-in stranger with the same message as a closed bootstrap', async () => {
    delete process.env.ADMIN_BOOTSTRAP_EMAILS

    const res = await session(req('POST', '/api/admin/session', { token: asCaller(STRANGER_UID) }))
    expect(res.status).toBe(403)
    // Telling an unknown caller which allowlist they missed is free recon.
    expect(await json<{ error: string }>(res)).toEqual({ error: 'Not an admin' })
  })

  describe('bootstrap', () => {
    beforeEach(async () => {
      // No admins and no marker — the only state in which bootstrap is open.
      await clearDb()
      process.env.ADMIN_BOOTSTRAP_EMAILS = `${STRANGER_UID}@example.com`
    })

    it('promotes the first allowlisted address to superadmin', async () => {
      const res = await session(req('POST', '/api/admin/session', { token: asCaller(STRANGER_UID) }))
      expect(res.status).toBe(200)

      expect(await getAdminDoc(STRANGER_UID)).toMatchObject({
        role: 'superadmin',
        createdBy: 'bootstrap',
      })
      expect(await auditEntries('admin.bootstrap')).toHaveLength(1)
    })

    it('matches the allowlist case- and whitespace-insensitively', async () => {
      process.env.ADMIN_BOOTSTRAP_EMAILS = `  ${STRANGER_UID.toUpperCase()}@EXAMPLE.COM , other@example.com`

      const res = await session(req('POST', '/api/admin/session', { token: asCaller(STRANGER_UID) }))
      expect(res.status).toBe(200)
    })

    it('refuses an address that is not on the allowlist', async () => {
      const res = await session(req('POST', '/api/admin/session', { token: asCaller('uid-outsider') }))
      expect(res.status).toBe(403)
      expect(await getAdminDoc('uid-outsider')).toBeUndefined()
    })

    it('is one-time — the marker keeps it closed even with no admins left', async () => {
      await session(req('POST', '/api/admin/session', { token: asCaller(STRANGER_UID) }))
      // Simulate the first superadmin later being removed by hand.
      await adminDb.collection(ADMINS_COLLECTION).doc(STRANGER_UID).delete()

      const res = await session(req('POST', '/api/admin/session', { token: asCaller(STRANGER_UID) }))
      expect(res.status).toBe(403)
      expect(await getAdminDoc(STRANGER_UID)).toBeUndefined()
    })

    it('seeds the marker instead when a superadmin already exists', async () => {
      // A superadmin created by hand before any marker. Bootstrap must close
      // rather than mint a second one — and stay closed if that admin is later
      // revoked.
      await seedAdmin('uid-handmade', { role: 'superadmin', regionIds: [] })

      const res = await session(req('POST', '/api/admin/session', { token: asCaller(STRANGER_UID) }))
      expect(res.status).toBe(403)
      expect(await getAdminDoc(STRANGER_UID)).toBeUndefined()

      const marker = await adminDb.doc(BOOTSTRAP_DOC).get()
      expect(marker.exists).toBe(true)
      expect(marker.data()).toMatchObject({ uid: 'uid-handmade' })
    })
  })
})
