import { describe, it, expect } from 'vitest'
import { isArchived, selectRoster } from './roster'

/**
 * The rule these pin down: archived PAX leave the roster but stay in the
 * directory. Getting this backwards in either direction is a real bug —
 * filtering the directory erases people from their own history, and not
 * filtering the roster leaves ghosts in crew counts.
 */
describe('archive semantics', () => {
  const bedrock = [
    { id: 'a', displayName: 'Gelato' },
    { id: 'b', displayName: 'Thorpedo', status: 'archived' as const },
    { id: 'c', displayName: 'Splice', status: 'active' as const },
  ]

  it('treats an absent status as active', () => {
    // Every pre-archive user doc has no status field at all.
    expect(isArchived({})).toBe(false)
    expect(isArchived({ status: 'active' })).toBe(false)
    expect(isArchived({ status: 'archived' })).toBe(true)
  })

  it('drops archived PAX from the roster', () => {
    expect(selectRoster(bedrock).map(u => u.id)).toEqual(['a', 'c'])
  })

  it('leaves the directory untouched so history still resolves', () => {
    // selectRoster must not mutate — the caller keeps using the same array as
    // the directory for author lookup, mentions and past finishers.
    const before = [...bedrock]
    selectRoster(bedrock)
    expect(bedrock).toEqual(before)
    expect(bedrock.find(u => u.id === 'b')?.displayName).toBe('Thorpedo')
  })

  it('preserves order', () => {
    expect(selectRoster(bedrock)[0].id).toBe('a')
  })

  it('handles a fully archived region without blowing up', () => {
    expect(selectRoster([{ id: 'x', status: 'archived' as const }])).toEqual([])
  })
})
