import { describe, it, expect } from 'vitest'
import { isArchived, selectRoster } from './roster'

const u = (id: string, status?: 'active' | 'archived') => ({ id, status })

describe('isArchived', () => {
  it('treats an absent status as active — the field is only written on archive', () => {
    expect(isArchived(u('a'))).toBe(false)
  })

  it('treats an explicit active status as active', () => {
    expect(isArchived(u('a', 'active'))).toBe(false)
  })

  it('treats archived as archived', () => {
    expect(isArchived(u('a', 'archived'))).toBe(true)
  })
})

describe('selectRoster', () => {
  it('drops archived PAX and keeps everyone else', () => {
    const users = [u('a'), u('b', 'archived'), u('c', 'active')]
    expect(selectRoster(users).map(x => x.id)).toEqual(['a', 'c'])
  })

  it('preserves order', () => {
    const users = [u('c'), u('a'), u('b', 'archived')]
    expect(selectRoster(users).map(x => x.id)).toEqual(['c', 'a'])
  })

  it('leaves the directory untouched — history still resolves archived PAX', () => {
    const users = [u('a'), u('b', 'archived')]
    selectRoster(users)
    expect(users).toHaveLength(2)
  })

  it('returns everyone when nobody is archived', () => {
    const users = [u('a'), u('b')]
    expect(selectRoster(users)).toHaveLength(2)
  })

  it('handles an empty directory', () => {
    expect(selectRoster([])).toEqual([])
  })
})
