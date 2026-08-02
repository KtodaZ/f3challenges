import { describe, it, expect } from 'vitest'
import { canActOnRegion, designationId, inviteRef, type AdminRecord } from './admin-auth'

function record(over: Partial<AdminRecord> = {}): AdminRecord {
  return {
    email: 'admin@example.com',
    role: 'regionAdmin',
    regionIds: ['sactown'],
    createdAt: '2026-08-01T00:00:00.000Z',
    createdBy: 'bootstrap',
    ...over,
  }
}

describe('canActOnRegion', () => {
  it('lets a superadmin act on any region', () => {
    const superadmin = record({ role: 'superadmin', regionIds: [] })
    expect(canActOnRegion(superadmin, 'bedrock')).toBe(true)
    expect(canActOnRegion(superadmin, 'sactown')).toBe(true)
  })

  it('lets a region admin act on their own region', () => {
    expect(canActOnRegion(record(), 'sactown')).toBe(true)
  })

  it('refuses a region admin acting on another region', () => {
    // The escalation this exists to stop: a Sactown admin reaching Bedrock.
    expect(canActOnRegion(record(), 'bedrock')).toBe(false)
  })

  it('refuses a region admin when no region was resolved', () => {
    // Fail closed: a missing region must never read as "any region".
    //
    // This is why requireAdmin() takes a REQUIRED regionId. It used to be
    // optional, and the list endpoints called requireAdmin(req) meaning "any
    // region, I'll filter myself" — which landed here and 403'd every region
    // admin out of the PAX and Feed screens. Endpoints that genuinely span
    // regions use requireAnyAdmin() and filter on record.regionIds.
    expect(canActOnRegion(record(), undefined)).toBe(false)
  })

  it('still lets a superadmin through with no region resolved', () => {
    expect(canActOnRegion(record({ role: 'superadmin' }), undefined)).toBe(true)
  })

  it('refuses a region admin with an empty region list', () => {
    expect(canActOnRegion(record({ regionIds: [] }), 'sactown')).toBe(false)
  })
})

describe('designationId', () => {
  it('is case- and whitespace-insensitive, so a designation matches at sign-in', () => {
    expect(designationId('  Babe@Example.com ')).toBe(designationId('babe@example.com'))
  })

  it('distinguishes different addresses', () => {
    expect(designationId('a@example.com')).not.toBe(designationId('b@example.com'))
  })

  it('does not embed the address', () => {
    const id = designationId('babe@example.com')
    expect(id).not.toContain('babe')
    expect(id).toMatch(/^[a-f0-9]{32}$/)
  })
})

describe('inviteRef', () => {
  it('never embeds the raw token', () => {
    // The token is the credential — the whole contents of the invite link.
    // Audit entries must not become a source of working invites.
    const token = 'super-secret-invite-token'
    expect(inviteRef(token)).not.toContain(token)
    expect(inviteRef(token)).toHaveLength(16)
  })

  it('is stable, so two entries about one invite correlate', () => {
    expect(inviteRef('abc')).toBe(inviteRef('abc'))
    expect(inviteRef('abc')).not.toBe(inviteRef('abd'))
  })
})
