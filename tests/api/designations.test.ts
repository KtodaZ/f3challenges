/**
 * Admin designations: designate by email, list, withdraw, and the claim that
 * happens silently on the designee's first sign-in.
 *
 * The claim path is the reason this suite runs against the real emulator. It is
 * one Firestore transaction doing "is something waiting for this address, is
 * the caller already an admin, grant and clear" — a mocked `runTransaction`
 * would let the single-use guarantee pass while being false.
 *
 * The security property under test throughout: a grant is bound to a
 * Google-verified email and nothing else. It is never bound to a PAX account,
 * because PAX identity is an unauthenticated localStorage id — binding to it
 * would turn "impersonate a PAX" into "become an admin".
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { GET as listDesignations, POST as designate } from '@/app/api/admin/designations/route'
import { DELETE as withdraw } from '@/app/api/admin/designations/[id]/route'
import { POST as session } from '@/app/api/admin/session/route'
import { designationId, tryClaimDesignation } from '@/lib/admin-auth'
import {
  asCaller, auditEntries, clearDb, ctx, getAdminDoc, getDesignation, json, req,
  seedAdmins, seedDesignation, seedInvite, seedUser,
  BEDROCK_UID, STRANGER_UID, SUPER_UID,
} from './harness'

const STRANGER_EMAIL = `${STRANGER_UID}@example.com`

/** First sign-in — the only thing a designee ever has to do. */
function signIn(uid: string) {
  return session(req('POST', '/api/admin/session', { token: asCaller(uid) }))
}

function post(body: unknown, uid = SUPER_UID) {
  return designate(req('POST', '/api/admin/designations', { token: asCaller(uid), body }))
}

beforeEach(async () => {
  await clearDb()
  await seedAdmins()
  await seedUser({ id: 'pax-1', displayName: 'Splice', regionId: 'bedrock' })
})

// ─────────────────────────────────────────────────────────────────────────────
// Regression: rows with no linked PAX used to 500.
//
// `auditWrite` was handed `paxName` present-but-undefined when nothing was
// linked. Firestore rejects `undefined` outright — the `stripUndefined()`
// non-negotiable in CLAUDE.md exists for exactly this — so the batch threw and
// NOTHING was written: no designation, no audit entry. Linking a PAX made
// `paxName` a string, which is why every other case here passed and the panel
// looked fine when tested with a PAX selected.
// ─────────────────────────────────────────────────────────────────────────────
describe('designations with no linked PAX', () => {
  it('designates without a linked PAX', async () => {
    const res = await post({ email: 'new@example.com', role: 'regionAdmin', regionIds: ['bedrock'] })
    expect(res.status).toBe(200)
  })

  it('withdraws one that has no linked PAX', async () => {
    await seedDesignation('new@example.com')
    const id = designationId('new@example.com')
    const res = await withdraw(
      req('DELETE', `/api/admin/designations/${id}`, { token: asCaller(SUPER_UID) }),
      ctx({ id })
    )
    expect(res.status).toBe(200)
  })

  it('writes an audit entry with no undefined field', async () => {
    await post({ email: 'new@example.com', role: 'regionAdmin', regionIds: ['bedrock'] })
    const entries = await auditEntries('admin.designate')
    expect(entries).toHaveLength(1)
    const after = entries[0].after as Record<string, unknown>
    expect(after).not.toHaveProperty('paxName')
    expect(after.role).toBe('regionAdmin')
  })
})

// ── designate ────────────────────────────────────────────────────────────────

describe('POST /api/admin/designations', () => {
  it('stores the grant against the address', async () => {
    const res = await post({ email: 'New@Example.com ', role: 'regionAdmin', regionIds: ['sactown'], userId: 'pax-1' })
    expect(res.status).toBe(200)

    expect(await getDesignation('new@example.com')).toMatchObject({
      email: 'new@example.com',
      role: 'regionAdmin',
      regionIds: ['sactown'],
      createdBy: SUPER_UID,
    })
  })

  it('normalizes the address, so case and stray spaces still match at sign-in', async () => {
    await post({ email: '  MiXeD@Example.COM  ', role: 'regionAdmin', regionIds: ['bedrock'] })
    expect(await getDesignation('mixed@example.com')).toBeDefined()
  })

  it('is idempotent — re-designating corrects the row instead of duplicating it', async () => {
    await post({ email: 'new@example.com', role: 'regionAdmin', regionIds: ['bedrock'] })
    await post({ email: 'new@example.com', role: 'regionAdmin', regionIds: ['sactown'] })

    const res = await listDesignations(req('GET', '/api/admin/designations', { token: asCaller(SUPER_UID) }))
    const { designations } = await json<{ designations: { regionIds: string[] }[] }>(res)
    expect(designations).toHaveLength(1)
    expect(designations[0].regionIds).toEqual(['sactown'])
  })

  it('rejects a malformed address', async () => {
    const res = await post({ email: 'not-an-email', role: 'regionAdmin', regionIds: ['bedrock'] })
    expect(res.status).toBe(422)
  })

  it('rejects an unknown region rather than creating an admin who governs nothing', async () => {
    const res = await post({ email: 'new@example.com', role: 'regionAdmin', regionIds: ['atlantis'] })
    expect(res.status).toBe(422)
  })

  it('rejects a region admin with no regions', async () => {
    const res = await post({ email: 'new@example.com', role: 'regionAdmin', regionIds: [] })
    expect(res.status).toBe(422)
  })

  it('forces a superadmin designation to carry no regions', async () => {
    await post({ email: 'new@example.com', role: 'superadmin', regionIds: ['bedrock'], userId: 'pax-1' })
    expect(await getDesignation('new@example.com')).toMatchObject({ role: 'superadmin', regionIds: [] })
  })

  it('rejects an unknown linked PAX now, not at sign-in', async () => {
    const res = await post({ email: 'new@example.com', role: 'regionAdmin', regionIds: ['bedrock'], userId: 'nobody' })
    expect(res.status).toBe(422)
  })

  it('denormalizes the linked PAX name', async () => {
    await post({ email: 'new@example.com', role: 'regionAdmin', regionIds: ['bedrock'], userId: 'pax-1' })
    expect(await getDesignation('new@example.com')).toMatchObject({ userId: 'pax-1', paxName: 'Splice' })
  })

  it('refuses an address that is already an admin', async () => {
    const res = await post({ email: `${BEDROCK_UID}@example.com`, role: 'regionAdmin', regionIds: ['bedrock'] })
    expect(res.status).toBe(409)
  })

  it('refuses a PAX already linked to an admin, so /status can never answer arbitrarily', async () => {
    await seedDesignation(STRANGER_EMAIL, { userId: 'pax-1', paxName: 'Splice' })
    await signIn(STRANGER_UID)

    const res = await post({ email: 'second@example.com', role: 'regionAdmin', regionIds: ['bedrock'], userId: 'pax-1' })
    expect(res.status).toBe(409)
  })

  it('refuses a PAX already designated to someone else, for the same reason', async () => {
    await post({ email: 'first@example.com', role: 'regionAdmin', regionIds: ['bedrock'], userId: 'pax-1' })

    const res = await post({ email: 'second@example.com', role: 'regionAdmin', regionIds: ['bedrock'], userId: 'pax-1' })
    expect(res.status).toBe(409)
  })

  it('refuses a PAX already linked to an outstanding invite link', async () => {
    // The two grant paths coexist, so the one-PAX-per-admin rule has to hold
    // across both — otherwise /api/admin/status could match a designation and
    // an invite claiming the same PAX and answer from whichever came back.
    await seedInvite('aaaaaaaaaaaaaaaaaaaaaaaa', { userId: 'pax-1', paxName: 'Splice' })

    const res = await post({ email: 'new@example.com', role: 'regionAdmin', regionIds: ['bedrock'], userId: 'pax-1' })
    expect(res.status).toBe(409)
  })

  it('lets the same address be re-designated with the same PAX', async () => {
    // Its own pending row must not block it, or correcting a region would be
    // impossible without withdrawing first.
    await post({ email: 'new@example.com', role: 'regionAdmin', regionIds: ['bedrock'], userId: 'pax-1' })

    const res = await post({ email: 'new@example.com', role: 'regionAdmin', regionIds: ['sactown'], userId: 'pax-1' })
    expect(res.status).toBe(200)
    expect(await getDesignation('new@example.com')).toMatchObject({ regionIds: ['sactown'] })
  })
})

// ── list / withdraw ──────────────────────────────────────────────────────────

describe('GET /api/admin/designations', () => {
  it('lists outstanding designations', async () => {
    await seedDesignation('a@example.com')
    await seedDesignation('b@example.com', { createdAt: '2026-08-02T00:00:00.000Z' })

    const res = await listDesignations(req('GET', '/api/admin/designations', { token: asCaller(SUPER_UID) }))
    const { designations } = await json<{ designations: { email: string }[] }>(res)

    expect(designations.map(d => d.email).sort()).toEqual(['a@example.com', 'b@example.com'])
  })
})

describe('DELETE /api/admin/designations/[id]', () => {
  it('withdraws it, so signing in grants nothing', async () => {
    await seedDesignation(STRANGER_EMAIL, { userId: 'pax-1', paxName: 'Splice' })
    const id = designationId(STRANGER_EMAIL)

    const res = await withdraw(
      req('DELETE', `/api/admin/designations/${id}`, { token: asCaller(SUPER_UID) }),
      ctx({ id })
    )
    expect(res.status).toBe(200)
    expect(await getDesignation(STRANGER_EMAIL)).toBeUndefined()

    const signedIn = await signIn(STRANGER_UID)
    expect(signedIn.status).toBe(403)
    expect(await getAdminDoc(STRANGER_UID)).toBeUndefined()
  })

  it('404s on an unknown id', async () => {
    const id = designationId('nobody@example.com')
    const res = await withdraw(
      req('DELETE', `/api/admin/designations/${id}`, { token: asCaller(SUPER_UID) }),
      ctx({ id })
    )
    expect(res.status).toBe(404)
  })

  it.each([
    ['a path separator', 'aaaa/bbbb'],
    ['not a digest', 'nope'],
    ['empty', ''],
  ])('404s rather than 500s on a malformed id (%s)', async (_label, bad) => {
    // An id containing "/" is an invalid document path and throws inside
    // Firestore, which would surface as a confusing 500.
    const res = await withdraw(
      req('DELETE', `/api/admin/designations/${bad}`, { token: asCaller(SUPER_UID) }),
      ctx({ id: bad })
    )
    expect(res.status).toBe(404)
  })
})

// ── claim, via the session endpoint ──────────────────────────────────────────

describe('first sign-in claims a designation', () => {
  it('grants exactly what the designation carries', async () => {
    await seedDesignation(STRANGER_EMAIL, { role: 'regionAdmin', regionIds: ['sactown'] })

    const res = await signIn(STRANGER_UID)
    expect(res.status).toBe(200)

    expect(await getAdminDoc(STRANGER_UID)).toMatchObject({
      role: 'regionAdmin',
      regionIds: ['sactown'],
      email: STRANGER_EMAIL,
    })
    expect(await getDesignation(STRANGER_EMAIL)).toBeUndefined()
  })

  it('carries the linked PAX onto the admin record', async () => {
    await seedDesignation(STRANGER_EMAIL, { userId: 'pax-1', paxName: 'Splice' })
    await signIn(STRANGER_UID)

    expect(await getAdminDoc(STRANGER_UID)).toMatchObject({ userId: 'pax-1', paxName: 'Splice' })
  })

  it('grants nothing to a different address', async () => {
    await seedDesignation(STRANGER_EMAIL)

    const res = await signIn('uid-someone-else')
    expect(res.status).toBe(403)
    expect(await getAdminDoc('uid-someone-else')).toBeUndefined()
    // Still waiting for the person it was meant for.
    expect(await getDesignation(STRANGER_EMAIL)).toBeDefined()
  })

  it('refuses an unverified email, so a non-Google provider can never claim one', async () => {
    await seedDesignation(STRANGER_EMAIL)
    const token = asCaller(STRANGER_UID, { email_verified: false })

    const res = await session(req('POST', '/api/admin/session', { token }))
    expect(res.status).toBe(401)
    expect(await getAdminDoc(STRANGER_UID)).toBeUndefined()
  })

  it('is single-use — a second sign-in re-reads the record, and nobody else can claim', async () => {
    await seedDesignation(STRANGER_EMAIL)

    expect((await signIn(STRANGER_UID)).status).toBe(200)
    expect(await getDesignation(STRANGER_EMAIL)).toBeUndefined()

    // Same person again: still an admin, no second grant.
    expect((await signIn(STRANGER_UID)).status).toBe(200)
    expect(await auditEntries('admin.designation.claim')).toHaveLength(1)
  })

  it('does not escalate someone who is already an admin', async () => {
    // Reachable only as a race — two tabs signing in at once, both reading no
    // record — because the session route returns an existing record before it
    // ever gets here, and POST /designations refuses an address that is
    // already an admin. Called directly, since that race can't be staged
    // through the route. A designation must never rewrite a live record:
    // changing an existing admin is a separate, audited action.
    await seedDesignation(`${BEDROCK_UID}@example.com`, { role: 'superadmin', regionIds: [] })

    const record = await tryClaimDesignation(BEDROCK_UID, `${BEDROCK_UID}@example.com`)
    expect(record).toMatchObject({ role: 'regionAdmin', regionIds: ['bedrock'] })
    expect(await getAdminDoc(BEDROCK_UID)).toMatchObject({
      role: 'regionAdmin',
      regionIds: ['bedrock'],
    })
    // The pending row is cleared so it stops showing as outstanding.
    expect(await getDesignation(`${BEDROCK_UID}@example.com`)).toBeUndefined()
  })

  it('leaves a sitting admin untouched when they sign in again', async () => {
    await seedDesignation(`${BEDROCK_UID}@example.com`, { role: 'superadmin', regionIds: [] })

    const res = await signIn(BEDROCK_UID)
    expect(res.status).toBe(200)
    expect(await getAdminDoc(BEDROCK_UID)).toMatchObject({ role: 'regionAdmin' })
  })

  it('writes an audit entry on a successful claim and none on a refused one', async () => {
    await seedDesignation(STRANGER_EMAIL)
    await signIn(STRANGER_UID)
    expect(await auditEntries('admin.designation.claim')).toHaveLength(1)

    await signIn('uid-late')
    expect(await auditEntries('admin.designation.claim')).toHaveLength(1)
  })

  it('401s when the caller is not signed in at all', async () => {
    await seedDesignation(STRANGER_EMAIL)
    const res = await session(req('POST', '/api/admin/session', {}))
    expect(res.status).toBe(401)
  })
})
