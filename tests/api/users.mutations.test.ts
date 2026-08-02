/**
 * PATCH /api/admin/users/[userId] — archive, unarchive, rename.
 *
 * Runs against the real Firestore emulator rather than a mock, because the
 * interesting part is machinery a mock would fake away: `FieldValue.delete()`
 * genuinely removing a field, a WriteBatch landing the mutation and its audit
 * entry together, and the rename transaction's uniqueness query.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { PATCH } from '@/app/api/admin/users/[userId]/route'
import {
  asCaller, auditEntries, clearDb, ctx, getUser, json, req,
  seedAdmin, seedAdmins, seedUser,
  BEDROCK_UID, SACTOWN_UID, SUPER_UID,
} from './harness'

function patch(token: string, userId: string, body: unknown) {
  return PATCH(
    req('PATCH', `/api/admin/users/${userId}`, { token, body }),
    ctx({ userId })
  )
}

beforeEach(async () => {
  await clearDb()
  await seedAdmins()
  await seedUser({ id: 'pax-1', displayName: 'Splice', regionId: 'bedrock' })
})

// ── 7: archive / unarchive ───────────────────────────────────────────────────

describe('archive / unarchive', () => {
  it('round-trips, leaving the status field absent again', async () => {
    const token = asCaller(BEDROCK_UID)

    const archived = await patch(token, 'pax-1', { action: 'archive' })
    expect(archived.status).toBe(200)
    expect(await getUser('pax-1')).toMatchObject({
      status: 'archived',
      archivedBy: BEDROCK_UID,
    })

    const restored = await patch(token, 'pax-1', { action: 'unarchive' })
    expect(restored.status).toBe(200)

    const after = await getUser('pax-1')
    // Cleared, not set to 'active' — every read path treats absent as active,
    // and a lingering `archivedAt` would misrender the panel.
    expect(after).not.toHaveProperty('status')
    expect(after).not.toHaveProperty('archivedAt')
    expect(after).not.toHaveProperty('archivedBy')
  })

  it('409s on archiving an already-archived PAX', async () => {
    const token = asCaller(BEDROCK_UID)
    await patch(token, 'pax-1', { action: 'archive' })

    const res = await patch(token, 'pax-1', { action: 'archive' })
    expect(res.status).toBe(409)
    expect(await json<{ error: string }>(res)).toEqual({ error: 'Already archived' })
  })

  it('409s on unarchiving a PAX who is not archived', async () => {
    const res = await patch(asCaller(BEDROCK_UID), 'pax-1', { action: 'unarchive' })
    expect(res.status).toBe(409)
    expect(await json<{ error: string }>(res)).toEqual({ error: 'Not archived' })
  })

  it('refuses an admin archiving their own linked PAX account', async () => {
    // The UI disables the button; this is the part that actually holds.
    await seedAdmin('uid-linked', {
      role: 'regionAdmin', regionIds: ['bedrock'], userId: 'pax-1', paxName: 'Splice',
    })

    const res = await patch(asCaller('uid-linked'), 'pax-1', { action: 'archive' })
    expect(res.status).toBe(409)
    expect(await getUser('pax-1')).not.toHaveProperty('status')
  })

  it('still lets a different admin archive that same PAX', async () => {
    await seedAdmin('uid-linked', { role: 'regionAdmin', regionIds: ['bedrock'], userId: 'pax-1' })

    const res = await patch(asCaller(BEDROCK_UID), 'pax-1', { action: 'archive' })
    expect(res.status).toBe(200)
  })

  it('404s on an unknown user', async () => {
    const res = await patch(asCaller(SUPER_UID), 'nobody', { action: 'archive' })
    expect(res.status).toBe(404)
  })

  it('422s on an unknown action', async () => {
    const res = await patch(asCaller(BEDROCK_UID), 'pax-1', { action: 'promote' })
    expect(res.status).toBe(422)
  })

  it('422s on a missing action rather than mutating anything', async () => {
    const res = await patch(asCaller(BEDROCK_UID), 'pax-1', {})
    expect(res.status).toBe(422)
    expect(await getUser('pax-1')).not.toHaveProperty('status')
  })
})

// ── 8: rename ────────────────────────────────────────────────────────────────

describe('rename', () => {
  it('renames and appends the old name to formerNames', async () => {
    const res = await patch(asCaller(BEDROCK_UID), 'pax-1', {
      action: 'rename', displayName: 'Claudio',
    })
    expect(res.status).toBe(200)

    expect(await getUser('pax-1')).toMatchObject({
      displayName: 'Claudio',
      // Lowercased: isNameTaken() compares formerNames case-insensitively by
      // storing them normalized, so a mixed-case entry would never match.
      formerNames: ['splice'],
    })
  })

  it('accumulates former names across successive renames without duplicates', async () => {
    const token = asCaller(BEDROCK_UID)
    await patch(token, 'pax-1', { action: 'rename', displayName: 'Claudio' })
    await patch(token, 'pax-1', { action: 'rename', displayName: 'Bunyan' })

    expect(await getUser('pax-1')).toMatchObject({
      displayName: 'Bunyan',
      formerNames: ['splice', 'claudio'],
    })
  })

  it('refuses a name held by an ACTIVE PAX in the same region', async () => {
    await seedUser({ id: 'pax-2', displayName: 'Claudio', regionId: 'bedrock' })

    const res = await patch(asCaller(BEDROCK_UID), 'pax-1', {
      action: 'rename', displayName: 'Claudio',
    })
    expect(res.status).toBe(409)
    expect(await getUser('pax-1')).toMatchObject({ displayName: 'Splice' })
  })

  it('refuses a name held by an ARCHIVED PAX', async () => {
    // Archived PAX keep their name reserved: mentions resolve by matching
    // displayName text, so reusing it would re-point their history.
    await seedUser({
      id: 'pax-gone', displayName: 'Claudio', regionId: 'bedrock',
      status: 'archived', archivedAt: '2026-02-01T00:00:00.000Z',
    })

    const res = await patch(asCaller(BEDROCK_UID), 'pax-1', {
      action: 'rename', displayName: 'Claudio',
    })
    expect(res.status).toBe(409)
  })

  it('refuses a name somebody has been renamed AWAY from', async () => {
    await seedUser({
      id: 'pax-2', displayName: 'Bunyan', regionId: 'bedrock', formerNames: ['claudio'],
    })

    const res = await patch(asCaller(BEDROCK_UID), 'pax-1', {
      action: 'rename', displayName: 'Claudio',
    })
    expect(res.status).toBe(409)
  })

  it('compares names case-insensitively', async () => {
    await seedUser({ id: 'pax-2', displayName: 'Claudio', regionId: 'bedrock' })

    const res = await patch(asCaller(BEDROCK_UID), 'pax-1', {
      action: 'rename', displayName: '  cLaUdIo  ',
    })
    expect(res.status).toBe(409)
  })

  it('allows a name that is only taken in ANOTHER region', async () => {
    // Name uniqueness is per region — two regions may each have a Claudio.
    await seedUser({ id: 'pax-other', displayName: 'Claudio', regionId: 'sactown' })

    const res = await patch(asCaller(BEDROCK_UID), 'pax-1', {
      action: 'rename', displayName: 'Claudio',
    })
    expect(res.status).toBe(200)
  })

  it('counts a region-less legacy PAX as Bedrock', async () => {
    // Written before regions existed. `where('regionId','==',…)` would miss it,
    // which is why the transaction reads the whole collection — and legacy PAX
    // are exactly the ones whose names appear in old mentions.
    await seedUser({ id: 'pax-legacy', displayName: 'Claudio' })

    const res = await patch(asCaller(BEDROCK_UID), 'pax-1', {
      action: 'rename', displayName: 'Claudio',
    })
    expect(res.status).toBe(409)
  })

  it('lets a PAX keep their own name (no self-collision)', async () => {
    const res = await patch(asCaller(BEDROCK_UID), 'pax-1', {
      action: 'rename', displayName: 'Splice',
    })
    expect(res.status).toBe(200)
  })

  it('422s on a name shorter than two characters', async () => {
    const res = await patch(asCaller(BEDROCK_UID), 'pax-1', { action: 'rename', displayName: 'X' })
    expect(res.status).toBe(422)
    expect(await getUser('pax-1')).toMatchObject({ displayName: 'Splice' })
  })

  it('422s on a whitespace-only name', async () => {
    const res = await patch(asCaller(BEDROCK_UID), 'pax-1', { action: 'rename', displayName: '   ' })
    expect(res.status).toBe(422)
  })

  it('checks the region before the name, so a cross-region rename cannot probe names', async () => {
    const res = await patch(asCaller(SACTOWN_UID), 'pax-1', {
      action: 'rename', displayName: 'Claudio',
    })
    expect(res.status).toBe(403)
  })
})

// ── 11: audit ────────────────────────────────────────────────────────────────

describe('audit', () => {
  it('records an archive with actor, region and before/after', async () => {
    await patch(asCaller(BEDROCK_UID), 'pax-1', { action: 'archive' })

    const [entry] = await auditEntries('user.archive')
    expect(entry).toMatchObject({
      actorUid: BEDROCK_UID,
      actorEmail: `${BEDROCK_UID}@example.com`,
      targetType: 'user',
      targetId: 'pax-1',
      regionId: 'bedrock',
      before: { status: 'active' },
    })
    expect(entry.after).toMatchObject({ status: 'archived', archivedBy: BEDROCK_UID })
  })

  it('records an unarchive', async () => {
    const token = asCaller(BEDROCK_UID)
    await patch(token, 'pax-1', { action: 'archive' })
    await patch(token, 'pax-1', { action: 'unarchive' })

    expect(await auditEntries('user.unarchive')).toHaveLength(1)
  })

  it('records a rename with both names', async () => {
    await patch(asCaller(SUPER_UID), 'pax-1', { action: 'rename', displayName: 'Claudio' })

    const [entry] = await auditEntries('user.rename')
    expect(entry).toMatchObject({
      actorUid: SUPER_UID,
      targetId: 'pax-1',
      regionId: 'bedrock',
      before: { displayName: 'Splice' },
    })
    expect(entry.after).toMatchObject({ displayName: 'Claudio' })
  })

  it('writes nothing when the mutation is refused', async () => {
    await patch(asCaller(SACTOWN_UID), 'pax-1', { action: 'archive' })
    await patch(asCaller(BEDROCK_UID), 'pax-1', { action: 'unarchive' })
    await patch(asCaller(BEDROCK_UID), 'pax-1', { action: 'rename', displayName: 'X' })

    expect(await auditEntries()).toHaveLength(0)
  })

  it('lands the audit entry and the mutation together', async () => {
    // Same WriteBatch. A log you can't trust is worse than none.
    await patch(asCaller(BEDROCK_UID), 'pax-1', { action: 'archive' })

    expect(await getUser('pax-1')).toMatchObject({ status: 'archived' })
    expect(await auditEntries()).toHaveLength(1)
  })
})
