import { describe, it, expect } from 'vitest'
import type { ChallengeTemplate } from './types'
import {
  getChallengeForDate,
  getChallengeById,
  getDayNumber,
  getDailyTarget,
  getMonthlyTotal,
  getTotalDays,
  repsFractionLabel,
  getChallengeDates,
} from './challenges'

// ─── Fixture ──────────────────────────────────────────────────────────────────

const APR: ChallengeTemplate = {
  id: 'apr-2026',
  name: 'The Merkin Gauntlet',
  hashtag: '#TheMerkinGauntlet',
  tagline: 'Test',
  month: 4,
  year: 2026,
  dailyMultiplier: 10,
  startDate: '2026-04-01',
  endDate: '2026-04-30',
  exercises: [
    { id: 'merkin',         name: 'Merkin',         shortName: 'Merkin'  },
    { id: 'diamond-merkin', name: 'Diamond Merkin', shortName: 'Diamond' },
    { id: 'wide-merkin',    name: 'Wide Arm',       shortName: 'Wide'    },
    { id: 'incline-merkin', name: 'Incline Merkin', shortName: 'Incline' },
    { id: 'decline-merkin', name: 'Decline Merkin', shortName: 'Decline' },
  ],
}

const FEB: ChallengeTemplate = {
  id: 'feb-2026',
  name: 'Merkin Challenge',
  hashtag: '#MerkinChallenge',
  tagline: 'Test',
  month: 2,
  year: 2026,
  dailyMultiplier: 10,
  startDate: '2026-02-01',
  endDate: '2026-02-28',
  exercises: [{ id: 'merkin', name: 'Merkin', shortName: 'Merkin' }],
}

// ─── getChallengeForDate ──────────────────────────────────────────────────────

describe('getChallengeForDate', () => {
  it('returns the matching challenge on the first day', () => {
    expect(getChallengeForDate('2026-04-01')?.id).toBe('apr-2026')
  })

  it('returns the matching challenge on the last day', () => {
    expect(getChallengeForDate('2026-04-30')?.id).toBe('apr-2026')
  })

  it('returns undefined the day before April starts (March challenge already ended)', () => {
    // March ends on 2026-03-31, April starts on 2026-04-01, so there is no gap.
    // Use a date before any challenge exists at all.
    expect(getChallengeForDate('2025-12-31')).toBeUndefined()
  })

  it('returns the march challenge for a march date', () => {
    expect(getChallengeForDate('2026-03-15')?.id).toBe('mar-2026')
  })

  it('returns undefined for a date with no challenge', () => {
    expect(getChallengeForDate('2025-01-01')).toBeUndefined()
  })
})

// ─── getChallengeById ─────────────────────────────────────────────────────────

describe('getChallengeById', () => {
  it('finds a challenge by id', () => {
    expect(getChallengeById('apr-2026')?.name).toBe('The Merkin Gauntlet')
  })

  it('returns undefined for unknown id', () => {
    expect(getChallengeById('nope-9999')).toBeUndefined()
  })
})

// ─── getTotalDays ─────────────────────────────────────────────────────────────

describe('getTotalDays', () => {
  it('returns 30 for April', () => {
    expect(getTotalDays(APR)).toBe(30)
  })

  it('returns 28 for February 2026', () => {
    expect(getTotalDays(FEB)).toBe(28)
  })

  it('returns 1 for a single-day challenge', () => {
    const single: ChallengeTemplate = { ...APR, startDate: '2026-06-01', endDate: '2026-06-01' }
    expect(getTotalDays(single)).toBe(1)
  })
})

// ─── getDayNumber ─────────────────────────────────────────────────────────────

describe('getDayNumber', () => {
  it('returns 1 for the start date', () => {
    expect(getDayNumber(APR, '2026-04-01')).toBe(1)
  })

  it('returns 30 for the last day of April', () => {
    expect(getDayNumber(APR, '2026-04-30')).toBe(30)
  })

  it('returns 15 for mid-month', () => {
    expect(getDayNumber(APR, '2026-04-15')).toBe(15)
  })

  it('returns null for a date before the challenge', () => {
    expect(getDayNumber(APR, '2026-03-31')).toBeNull()
  })

  it('returns null for a date after the challenge', () => {
    expect(getDayNumber(APR, '2026-05-01')).toBeNull()
  })
})

// ─── getDailyTarget ───────────────────────────────────────────────────────────

describe('getDailyTarget', () => {
  it('returns null outside the challenge window', () => {
    expect(getDailyTarget(APR, '2026-05-15')).toBeNull()
  })

  it('day 1 total is multiplier × 1 for each exercise', () => {
    const target = getDailyTarget(APR, '2026-04-01')!
    expect(target.day).toBe(1)
    expect(target.totalReps).toBe(10)          // 1 × 10
    expect(target.repsPerExercise).toBe(2)     // 10 / 5 exercises
    expect(target.exercises).toHaveLength(5)
    expect(target.exercises[0].reps).toBe(2)
  })

  it('day 10 total is multiplier × 10', () => {
    const target = getDailyTarget(APR, '2026-04-10')!
    expect(target.totalReps).toBe(100)
    expect(target.repsPerExercise).toBe(20)
  })

  it('includes correct exercise data', () => {
    const target = getDailyTarget(APR, '2026-04-01')!
    expect(target.exercises[0].exercise.id).toBe('merkin')
  })

  it('single-exercise challenge distributes all reps to that exercise', () => {
    const target = getDailyTarget(FEB, '2026-02-01')!
    expect(target.repsPerExercise).toBe(10)
    expect(target.exercises[0].reps).toBe(10)
  })
})

// ─── getMonthlyTotal ──────────────────────────────────────────────────────────

describe('getMonthlyTotal', () => {
  it('computes sum of 1×m + 2×m + … + 30×m for April (multiplier=10)', () => {
    // Sum 1..30 = 465, × 10 = 4650
    expect(getMonthlyTotal(APR)).toBe(4650)
  })

  it('computes sum for February (28 days, multiplier=10)', () => {
    // Sum 1..28 = 406, × 10 = 4060
    expect(getMonthlyTotal(FEB)).toBe(4060)
  })

  it('handles single-day challenge', () => {
    const single: ChallengeTemplate = { ...APR, startDate: '2026-06-01', endDate: '2026-06-01' }
    expect(getMonthlyTotal(single)).toBe(10)   // day 1 × multiplier 10
  })
})

// ─── repsFractionLabel ────────────────────────────────────────────────────────

describe('repsFractionLabel', () => {
  it('returns "Done ✓" at 1.0', () => {
    expect(repsFractionLabel(1)).toBe('Done ✓')
  })

  it('returns "Done ✓" above 1.0', () => {
    expect(repsFractionLabel(1.5)).toBe('Done ✓')
  })

  it('returns "3/4 Done" at 0.75', () => {
    expect(repsFractionLabel(0.75)).toBe('3/4 Done')
  })

  it('returns "3/4 Done" between 0.75 and 1', () => {
    expect(repsFractionLabel(0.9)).toBe('3/4 Done')
  })

  it('returns "Halfway" at 0.5', () => {
    expect(repsFractionLabel(0.5)).toBe('Halfway')
  })

  it('returns "1/4 Done" at 0.25', () => {
    expect(repsFractionLabel(0.25)).toBe('1/4 Done')
  })

  it('returns "Not started" at 0', () => {
    expect(repsFractionLabel(0)).toBe('Not started')
  })

  it('returns "Not started" below 0.25', () => {
    expect(repsFractionLabel(0.1)).toBe('Not started')
  })
})

// ─── getChallengeDates ────────────────────────────────────────────────────────

describe('getChallengeDates', () => {
  it('returns the correct number of dates for April', () => {
    expect(getChallengeDates(APR)).toHaveLength(30)
  })

  it('starts on the challenge start date', () => {
    const dates = getChallengeDates(APR)
    expect(dates[0]).toBe('2026-04-01')
  })

  it('ends on the challenge end date', () => {
    const dates = getChallengeDates(APR)
    expect(dates[dates.length - 1]).toBe('2026-04-30')
  })

  it('each successive date is exactly one day later', () => {
    const dates = getChallengeDates(APR)
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1] + 'T12:00:00Z')
      const curr = new Date(dates[i]  + 'T12:00:00Z')
      expect(curr.getTime() - prev.getTime()).toBe(86_400_000)
    }
  })

  it('returns 28 dates for February 2026', () => {
    expect(getChallengeDates(FEB)).toHaveLength(28)
  })
})
