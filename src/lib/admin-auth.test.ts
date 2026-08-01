import { describe, it, expect } from 'vitest'
import { canActOnRegion, type AdminRecord } from './admin-auth'

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
    // Callers must resolve the target region from Firestore. If they couldn't,
    // failing closed is the only safe answer — a missing region must never
    // read as "any region".
    expect(canActOnRegion(record(), undefined)).toBe(false)
  })

  it('still lets a superadmin through with no region resolved', () => {
    expect(canActOnRegion(record({ role: 'superadmin' }), undefined)).toBe(true)
  })

  it('refuses a region admin with an empty region list', () => {
    expect(canActOnRegion(record({ regionIds: [] }), 'sactown')).toBe(false)
  })
})
