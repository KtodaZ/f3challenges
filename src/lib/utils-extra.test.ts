import { describe, it, expect } from 'vitest'
import {
  cn,
  stripUndefined,
  formatDate,
  calculateStreak,
  extractHashtags,
  extractMentionNames,
} from './utils'

// ─── cn ───────────────────────────────────────────────────────────────────────

describe('cn', () => {
  it('merges class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('deduplicates conflicting Tailwind classes (last wins)', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('filters falsy values', () => {
    expect(cn('foo', false, undefined, null, 'bar')).toBe('foo bar')
  })

  it('handles conditional object syntax', () => {
    expect(cn({ 'font-bold': true, italic: false })).toBe('font-bold')
  })

  it('returns empty string when nothing is passed', () => {
    expect(cn()).toBe('')
  })
})

// ─── stripUndefined ───────────────────────────────────────────────────────────

describe('stripUndefined', () => {
  it('removes undefined values', () => {
    expect(stripUndefined({ a: 1, b: undefined })).toEqual({ a: 1 })
  })

  it('keeps null values (only strips undefined)', () => {
    expect(stripUndefined({ a: null, b: undefined })).toEqual({ a: null })
  })

  it('keeps zero and empty string', () => {
    expect(stripUndefined({ a: 0, b: '', c: undefined })).toEqual({ a: 0, b: '' })
  })

  it('keeps false', () => {
    expect(stripUndefined({ flag: false, gone: undefined })).toEqual({ flag: false })
  })

  it('returns empty object when all values are undefined', () => {
    expect(stripUndefined({ a: undefined, b: undefined })).toEqual({})
  })

  it('is a no-op when there are no undefined values', () => {
    const obj = { x: 1, y: 'hello' }
    expect(stripUndefined(obj)).toEqual(obj)
  })
})

// ─── formatDate ───────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('formats a known date correctly', () => {
    // 2026-04-01 is a Wednesday
    expect(formatDate('2026-04-01')).toBe('Wed, Apr 1')
  })

  it('formats end of month', () => {
    // 2026-04-30 is a Thursday
    expect(formatDate('2026-04-30')).toBe('Thu, Apr 30')
  })

  it('formats a February date', () => {
    // 2026-02-28 is a Saturday
    expect(formatDate('2026-02-28')).toBe('Sat, Feb 28')
  })
})

// ─── calculateStreak ─────────────────────────────────────────────────────────

describe('calculateStreak', () => {
  it('returns zeros for empty input', () => {
    expect(calculateStreak([])).toEqual({ current: 0, longest: 0 })
  })

  it('returns longest=1 for a single date', () => {
    // A single date cannot form a run of 2, so longest stays at 1
    const result = calculateStreak(['2026-04-01'])
    expect(result.longest).toBe(1)
  })

  it('counts a consecutive run correctly', () => {
    const dates = ['2026-04-01', '2026-04-02', '2026-04-03']
    const result = calculateStreak(dates)
    expect(result.longest).toBe(3)
  })

  it('resets run on a gap', () => {
    // gap between 03 and 05 — two separate runs of 2
    const dates = ['2026-04-01', '2026-04-02', '2026-04-05', '2026-04-06']
    const result = calculateStreak(dates)
    expect(result.longest).toBe(2)
  })

  it('picks the longest of multiple runs', () => {
    const dates = [
      '2026-04-01', '2026-04-02',             // run of 2
      '2026-04-05', '2026-04-06', '2026-04-07', '2026-04-08', // run of 4
    ]
    const result = calculateStreak(dates)
    expect(result.longest).toBe(4)
  })

  it('current streak is 0 when last date is more than 1 day ago', () => {
    // Use a date far in the past so daysSinceLast > 1
    const old = ['2020-01-01', '2020-01-02']
    expect(calculateStreak(old).current).toBe(0)
  })
})

// ─── extractHashtags ──────────────────────────────────────────────────────────

describe('extractHashtags', () => {
  it('extracts a single hashtag', () => {
    expect(extractHashtags('great #workout today')).toEqual(['workout'])
  })

  it('extracts multiple hashtags', () => {
    expect(extractHashtags('#merkin #grind keep going')).toEqual(['merkin', 'grind'])
  })

  it('lowercases hashtags', () => {
    expect(extractHashtags('#TheMerkinGauntlet')).toEqual(['themerkingauntlet'])
  })

  it('returns empty array when no hashtags', () => {
    expect(extractHashtags('no tags here')).toEqual([])
  })
})

// ─── extractMentionNames ─────────────────────────────────────────────────────

describe('extractMentionNames — no users (fallback)', () => {
  it('extracts a single-word mention', () => {
    expect(extractMentionNames('@Snuggles great job')).toEqual(['Snuggles'])
  })

  it('only captures the first word of a multi-word name without a user list', () => {
    expect(extractMentionNames('@Big Daddy crushed it')).toEqual(['Big'])
  })

  it('extracts multiple mentions', () => {
    expect(extractMentionNames('@Snuggles and @Sandman showed up')).toEqual([
      'Snuggles',
      'Sandman',
    ])
  })

  it('returns empty array when no mentions', () => {
    expect(extractMentionNames('no mentions here')).toEqual([])
  })
})

describe('extractMentionNames — with users list', () => {
  const users = [
    { displayName: 'Snuggles' },
    { displayName: 'Big Daddy' },
    { displayName: 'Big' },
    { displayName: 'Sandman' },
  ]

  it('extracts a single-word name', () => {
    expect(extractMentionNames('@Snuggles great job', users)).toEqual(['Snuggles'])
  })

  it('extracts a multi-word name correctly', () => {
    expect(extractMentionNames('@Big Daddy crushed it', users)).toEqual(['Big Daddy'])
  })

  it('prefers the longer name over the shorter prefix', () => {
    // "Big Daddy" should win over "Big"
    expect(extractMentionNames('@Big Daddy is here', users)).toEqual(['Big Daddy'])
  })

  it('matches the shorter name when the longer one is not present', () => {
    expect(extractMentionNames('@Big showed up', users)).toEqual(['Big'])
  })

  it('is case-insensitive', () => {
    expect(extractMentionNames('@snuggles did the work', users)).toEqual(['Snuggles'])
  })

  it('extracts multiple mentions', () => {
    const result = extractMentionNames('@Snuggles and @Sandman showed up', users)
    expect(result).toEqual(expect.arrayContaining(['Snuggles', 'Sandman']))
    expect(result).toHaveLength(2)
  })

  it('returns empty array when no known users are mentioned', () => {
    expect(extractMentionNames('@Ghost showed up', users)).toEqual([])
  })
})
