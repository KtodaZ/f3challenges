/**
 * Admin invites: create, list, revoke, claim.
 *
 * The claim path is the reason this suite runs against the real emulator. It
 * is one Firestore transaction doing "is this invite live, is the caller
 * already an admin, grant and burn" — a mocked `runTransaction` would let the
 * single-use guarantee pass while being false.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { GET as listInvites, POST as createInvite } from '@/app/api/admin/invites/route'
import { DELETE as revokeInvite } from '@/app/api/admin/invites/[token]/route'
import { POST as claimInvite } from '@/app/api/admin/invites/claim/route'
import { inviteRef } from '@/lib/admin-auth'
import {
  asCaller, auditEntries, clearDb, ctx, getAdminDoc, getInvite, json, req,
  seedAdmins, seedInvite, seedUser,
  BEDROCK_UID, STRANGER_UID, SUPER_UID,
} from './harness'

/** A token that satisfies the route's `[A-Za-z0-9_-]{16,128}` shape. */
const TOKEN = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const OTHER_TOKEN = 'bbbbbbbbbbbbbbbbbbbbbbbb'

function claim(token: string, body: unknown) {
  return claimInvite(req('POST', '/api/admin/invites/claim', { token, body }))
}

beforeEach(async () => {
  await clearDb()
  await seedAdmins()
  await seedUser({ id: 'pax-1', displayName: 'Splice', regionId: 'bedrock' })
})

// ─────────────────────────────────────────────────────────────────────────────
// Regression: invites with no linked PAX used to 500.
//
// `auditWrite` was handed `paxName` present-but-undefined by both invite routes
// when nothing was linked. Firestore rejects `undefined` outright — the
// `stripUndefined()` non-negotiable in CLAUDE.md exists for exactly this — so
// the batch threw and NOTHING was written: no invite, no audit entry. Linking a
// PAX made `paxName` a string, which is why every other case in this file
// passed and the panel looked fine when tested with a PAX selected.
//
// Fixed by stripping undefined recursively inside `auditWrite`, so no caller
// can reintroduce it — the audit payload is an arbitrary nested snapshot, and
// the top-level guard could never have caught a field one level down.
// ─────────────────────────────────────────────────────────────────────────────
describe('invites with no linked PAX', () => {
  it('creates an invite without a linked PAX', async () => {
    const res = await createInvite(req('POST', '/api/admin/invites', {
      token: asCaller(SUPER_UID),
      body: { role: 'regionAdmin', regionIds: ['bedrock'] },
    }))
    expect(res.status).toBe(200)
  })

  it('revokes an invite that has no linked PAX', async () => {
    await seedInvite(TOKEN)
    const res = await revokeInvite(
      req('DELETE', `/api/admin/invites/${TOKEN}`, { token: asCaller(SUPER_UID) }),
      ctx({ token: TOKEN })
    )
    expect(res.status).toBe(200)
  })

  it('writes an audit entry with no undefined field', async () => {
    await createInvite(req('POST', '/api/admin/invites', {
      token: asCaller(SUPER_UID),
      body: { role: 'regionAdmin', regionIds: ['bedrock'] },
    }))
    const entries = await auditEntries()
    expect(entries).toHaveLength(1)
    const after = entries[0].after as Record<string, unknown>
    expect(after).not.toHaveProperty('paxName')
    expect(after.role).toBe('regionAdmin')
  })
})

// ── create ───────────────────────────────────────────────────────────────────

describe('POST /api/admin/invites', () => {
  it('mints a token and stores the grant server-side', async () => {
    const res = await createInvite(req('POST', '/api/admin/invites', {
      token: asCaller(SUPER_UID),
      body: { role: 'regionAdmin', regionIds: ['sactown'], userId: 'pax-1' },
    }))
    expect(res.status).toBe(200)

    const { token } = await json<{ token: string }>(res)
    expect(token).toMatch(/^[A-Za-z0-9_-]{16,128}$/)

    // Role and regions live on the document, not in the link — the recipient
    // can't influence what they're granted.
    expect(await getInvite(token)).toMatchObject({
      role: 'regionAdmin',
      regionIds: ['sactown'],
      createdBy: SUPER_UID,
    })
  })

  it('rejects an unknown region rather than creating an admin who governs nothing', async () => {
    const res = await createInvite(req('POST', '/api/admin/invites', {
      token: asCaller(SUPER_UID),
      body: { role: 'regionAdmin', regionIds: ['atlantis'] },
    }))
    expect(res.status).toBe(422)
  })

  it('rejects a region admin invite with no regions', async () => {
    const res = await createInvite(req('POST', '/api/admin/invites', {
      token: asCaller(SUPER_UID),
      body: { role: 'regionAdmin', regionIds: [] },
    }))
    expect(res.status).toBe(422)
  })

  it('forces a superadmin invite to carry no regions', async () => {
    const res = await createInvite(req('POST', '/api/admin/invites', {
      token: asCaller(SUPER_UID),
      body: { role: 'superadmin', regionIds: ['bedrock'], userId: 'pax-1' },
    }))
    const { token } = await json<{ token: string }>(res)

    expect(await getInvite(token)).toMatchObject({ role: 'superadmin', regionIds: [] })
  })

  it('rejects an unknown linked PAX at create time, not claim time', async () => {
    const res = await createInvite(req('POST', '/api/admin/invites', {
      token: asCaller(SUPER_UID),
      body: { role: 'regionAdmin', regionIds: ['bedrock'], userId: 'nobody' },
    }))
    expect(res.status).toBe(422)
  })

  it('denormalizes the linked PAX name onto the invite', async () => {
    await seedUser({ id: 'pax-1', displayName: 'Splice', regionId: 'bedrock' })
    const res = await createInvite(req('POST', '/api/admin/invites', {
      token: asCaller(SUPER_UID),
      body: { role: 'regionAdmin', regionIds: ['bedrock'], userId: 'pax-1' },
    }))
    const { token } = await json<{ token: string }>(res)

    expect(await getInvite(token)).toMatchObject({ userId: 'pax-1', paxName: 'Splice' })
  })
})

// ── 11: the token must never reach the audit log ─────────────────────────────

describe('audit never carries the raw token', () => {
  it('on create', async () => {
    const res = await createInvite(req('POST', '/api/admin/invites', {
      token: asCaller(SUPER_UID),
      body: { role: 'regionAdmin', regionIds: ['bedrock'], userId: 'pax-1' },
    }))
    const { token } = await json<{ token: string }>(res)

    const [entry] = await auditEntries('admin.invite')
    // The token IS the credential. An audit export containing one hands out a
    // working invite link.
    expect(JSON.stringify(entry)).not.toContain(token)
    expect(entry.targetId).toBe(inviteRef(token))
  })

  it('on revoke', async () => {
    await seedInvite(TOKEN, { userId: 'pax-1', paxName: 'Splice' })
    await revokeInvite(
      req('DELETE', `/api/admin/invites/${TOKEN}`, { token: asCaller(SUPER_UID) }),
      ctx({ token: TOKEN })
    )

    const [entry] = await auditEntries('admin.invite.revoke')
    expect(JSON.stringify(entry)).not.toContain(TOKEN)
    expect(entry.targetId).toBe(inviteRef(TOKEN))
  })

  it('on claim', async () => {
    await seedInvite(TOKEN)
    await claim(asCaller(STRANGER_UID), { token: TOKEN })

    const [entry] = await auditEntries('admin.invite.claim')
    expect(JSON.stringify(entry)).not.toContain(TOKEN)
  })
})

// ── list / revoke ────────────────────────────────────────────────────────────

describe('GET /api/admin/invites', () => {
  it('flags expired invites without hiding them', async () => {
    await seedInvite(TOKEN, { expiresAt: '2020-01-01T00:00:00.000Z' })
    await seedInvite(OTHER_TOKEN, { createdAt: '2026-08-02T00:00:00.000Z' })

    const res = await listInvites(req('GET', '/api/admin/invites', { token: asCaller(SUPER_UID) }))
    const { invites } = await json<{ invites: { token: string; expired: boolean }[] }>(res)

    expect(invites).toHaveLength(2)
    expect(invites.find(i => i.token === TOKEN)?.expired).toBe(true)
    expect(invites.find(i => i.token === OTHER_TOKEN)?.expired).toBe(false)
  })
})

describe('DELETE /api/admin/invites/[token]', () => {
  it('deletes the invite so the link stops working', async () => {
    await seedInvite(TOKEN, { userId: 'pax-1', paxName: 'Splice' })

    const res = await revokeInvite(
      req('DELETE', `/api/admin/invites/${TOKEN}`, { token: asCaller(SUPER_UID) }),
      ctx({ token: TOKEN })
    )
    expect(res.status).toBe(200)
    expect(await getInvite(TOKEN)).toBeUndefined()

    const claimed = await claim(asCaller(STRANGER_UID), { token: TOKEN })
    expect(claimed.status).toBe(403)
  })

  it('404s on an unknown invite', async () => {
    const res = await revokeInvite(
      req('DELETE', '/api/admin/invites/nope', { token: asCaller(SUPER_UID) }),
      ctx({ token: 'nope' })
    )
    expect(res.status).toBe(404)
  })
})

// ── 9: claim ─────────────────────────────────────────────────────────────────

describe('POST /api/admin/invites/claim', () => {
  it('grants exactly what the invite carries, to whoever signs in with it', async () => {
    await seedInvite(TOKEN, { role: 'regionAdmin', regionIds: ['sactown'] })

    const res = await claim(asCaller(STRANGER_UID), { token: TOKEN })
    expect(res.status).toBe(200)

    expect(await getAdminDoc(STRANGER_UID)).toMatchObject({
      role: 'regionAdmin',
      regionIds: ['sactown'],
      email: `${STRANGER_UID}@example.com`,
    })
  })

  it('is single-use — a second claim fails', async () => {
    await seedInvite(TOKEN)

    const first = await claim(asCaller(STRANGER_UID), { token: TOKEN })
    expect(first.status).toBe(200)
    // Redemption deletes the invite; a missing one is rejected by the same
    // check as an invalid one.
    expect(await getInvite(TOKEN)).toBeUndefined()

    const second = await claim(asCaller('uid-second-person'), { token: TOKEN })
    expect(second.status).toBe(403)
    expect(await getAdminDoc('uid-second-person')).toBeUndefined()
  })

  it('refuses an expired invite', async () => {
    await seedInvite(TOKEN, { expiresAt: '2020-01-01T00:00:00.000Z' })

    const res = await claim(asCaller(STRANGER_UID), { token: TOKEN })
    expect(res.status).toBe(403)
    expect((await json<{ error: string }>(res)).error).toMatch(/expired/i)
    expect(await getAdminDoc(STRANGER_UID)).toBeUndefined()
  })

  it.each([
    ['a path separator', 'aaaa/bbbb/cccc/dddd'],
    ['too short', 'abc'],
    ['illegal characters', 'aaaaaaaaaaaaaaaa$$$$'],
    ['empty', ''],
  ])('403s rather than 500s on a malformed token (%s)', async (_label, bad) => {
    // A token containing "/" is an invalid document path and throws inside
    // Firestore — the shape check exists so that surfaces as "that link isn't
    // valid" rather than a confusing 500.
    const res = await claim(asCaller(STRANGER_UID), { token: bad })
    expect(res.status).toBe(403)
  })

  it('403s on a missing token field', async () => {
    const res = await claim(asCaller(STRANGER_UID), {})
    expect(res.status).toBe(403)
  })

  it('401s when the caller is not signed in at all', async () => {
    await seedInvite(TOKEN)
    const res = await claimInvite(req('POST', '/api/admin/invites/claim', { body: { token: TOKEN } }))
    expect(res.status).toBe(401)
  })

  it('does NOT consume an invite when the claimer is already an admin', async () => {
    // Almost certainly someone else's link. Burning it would silently destroy
    // an invite the superadmin has already sent, with nothing in the audit
    // trail to explain where it went.
    await seedInvite(TOKEN, { role: 'superadmin', regionIds: [] })

    const res = await claim(asCaller(BEDROCK_UID), { token: TOKEN })
    expect(res.status).toBe(200)
    expect(await json<{ alreadyAdmin: boolean }>(res)).toMatchObject({ alreadyAdmin: true })

    // Still live for the intended recipient…
    expect(await getInvite(TOKEN)).toBeDefined()
    // …and no privilege escalation: the existing record is returned unchanged.
    expect(await getAdminDoc(BEDROCK_UID)).toMatchObject({
      role: 'regionAdmin',
      regionIds: ['bedrock'],
    })

    const intended = await claim(asCaller(STRANGER_UID), { token: TOKEN })
    expect(intended.status).toBe(200)
    expect(await getAdminDoc(STRANGER_UID)).toMatchObject({ role: 'superadmin' })
  })

  it('writes an audit entry on a successful claim and none on a refused one', async () => {
    await seedInvite(TOKEN)
    await claim(asCaller(STRANGER_UID), { token: TOKEN })
    expect(await auditEntries('admin.invite.claim')).toHaveLength(1)

    await claim(asCaller('uid-late'), { token: TOKEN })
    expect(await auditEntries('admin.invite.claim')).toHaveLength(1)
  })
})
