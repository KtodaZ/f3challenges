import { describe, it, expect } from 'vitest'
import type { ChallengeTemplate } from './types'
import {
  getChallengeForDate,
  getChallengeById,
  getDayNumber,
  getDailyTarget,
  getMonthlyTotal,
  getRequiredDays,
  getTotalDays,
  isRestDay,
  conditionalRestApplies,
  repsFractionLabel,
  getChallengeDates,
} from './challenges'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const APR: ChallengeTemplate = {
  id: 'apr-2026',
  name: 'The Merkin Gauntlet',
  hashtag: '#TheMerkinGauntlet',
  tagline: 'Test',
  month: 4,
  year: 2026,
  type: 'escalating',
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
  type: 'escalating',
  dailyMultiplier: 10,
  startDate: '2026-02-01',
  endDate: '2026-02-28',
  exercises: [{ id: 'merkin', name: 'Merkin', shortName: 'Merkin' }],
}

// Weekly-tiers fixture with rest days and a conditional rest day
const MAY: ChallengeTemplate = {
  id: 'may-2026',
  name: 'Death by Basics',
  hashtag: '#DeathByBasics',
  tagline: 'Test',
  month: 5,
  year: 2026,
  type: 'weekly-tiers',
  startDate: '2026-05-01',
  endDate: '2026-05-31',
  exercises: [
    { id: 'pullup',    name: 'Pull-Up',   shortName: 'Pull-Up'  },
    { id: 'pushup',    name: 'Push-Up',   shortName: 'Push-Up'  },
    { id: 'air-squat', name: 'Air Squat', shortName: 'Squat'    },
    { id: 'dead-hang', name: 'Dead Hang', shortName: 'DeadHang', unit: 'seconds' },
  ],
  weeklyTiers: [
    {
      startDay: 1, endDay: 8,
      targets: [
        { exerciseId: 'pullup',    amount: 20 },
        { exerciseId: 'pushup',    amount: 30 },
        { exerciseId: 'air-squat', amount: 40 },
        { exerciseId: 'dead-hang', amount: 30 },
      ],
    },
    {
      startDay: 9, endDay: 16,
      targets: [
        { exerciseId: 'pullup',    amount: 30 },
        { exerciseId: 'pushup',    amount: 40 },
        { exerciseId: 'air-squat', amount: 50 },
        { exerciseId: 'dead-hang', amount: 60 },
      ],
    },
    {
      startDay: 17, endDay: 23,
      targets: [
        { exerciseId: 'pullup',    amount: 40 },
        { exerciseId: 'pushup',    amount: 50 },
        { exerciseId: 'air-squat', amount: 60 },
        { exerciseId: 'dead-hang', amount: 90 },
      ],
    },
    {
      startDay: 24, endDay: 31,
      targets: [
        { exerciseId: 'pullup',    amount: 50 },
        { exerciseId: 'pushup',    amount: 60 },
        { exerciseId: 'air-squat', amount: 70 },
        { exerciseId: 'dead-hang', amount: 120 },
      ],
    },
  ],
  restDates: ['2026-05-25'],
  conditionalRestDates: [
    { date: '2026-05-26', conditionLabel: 'Did you do the Murph?', conditionType: 'logged-previous-day' },
  ],
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

// ─── weekly-tiers: getDailyTarget ─────────────────────────────────────────────

describe('getDailyTarget — weekly-tiers', () => {
  it('returns correct targets for week 1 (day 1)', () => {
    const target = getDailyTarget(MAY, '2026-05-01')!
    expect(target.isRestDay).toBe(false)
    expect(target.day).toBe(1)
    expect(target.exercises).toHaveLength(4)
    expect(target.exercises.find(e => e.exercise.id === 'pullup')?.reps).toBe(20)
    expect(target.exercises.find(e => e.exercise.id === 'pushup')?.reps).toBe(30)
    expect(target.exercises.find(e => e.exercise.id === 'air-squat')?.reps).toBe(40)
    expect(target.exercises.find(e => e.exercise.id === 'dead-hang')?.reps).toBe(30)
  })

  it('excludes seconds-unit exercises from totalReps', () => {
    const target = getDailyTarget(MAY, '2026-05-01')!
    expect(target.totalReps).toBe(20 + 30 + 40) // 90 — dead hang (30s) excluded
  })

  it('returns week 2 targets on day 9', () => {
    const target = getDailyTarget(MAY, '2026-05-09')!
    expect(target.exercises.find(e => e.exercise.id === 'pullup')?.reps).toBe(30)
    expect(target.exercises.find(e => e.exercise.id === 'dead-hang')?.reps).toBe(60)
  })

  it('returns week 4 targets on day 24', () => {
    const target = getDailyTarget(MAY, '2026-05-24')!
    expect(target.exercises.find(e => e.exercise.id === 'pullup')?.reps).toBe(50)
  })

  it('returns null outside the challenge window', () => {
    expect(getDailyTarget(MAY, '2026-06-01')).toBeNull()
  })
})

// ─── isRestDay ────────────────────────────────────────────────────────────────

describe('isRestDay', () => {
  it('returns true for a fixed rest date', () => {
    expect(isRestDay(MAY, '2026-05-25')).toBe(true)
  })

  it('returns false for a conditional rest date (not unconditionally a rest day)', () => {
    expect(isRestDay(MAY, '2026-05-26')).toBe(false)
  })

  it('returns false for a normal workout day', () => {
    expect(isRestDay(MAY, '2026-05-01')).toBe(false)
  })

  it('getDailyTarget marks fixed rest dates as isRestDay:true with no exercises', () => {
    const target = getDailyTarget(MAY, '2026-05-25')!
    expect(target.isRestDay).toBe(true)
    expect(target.exercises).toHaveLength(0)
    expect(target.totalReps).toBe(0)
  })

  it('getDailyTarget marks conditional rest dates with isConditionalRestDay flag, not isRestDay', () => {
    const target = getDailyTarget(MAY, '2026-05-26')!
    expect(target.isRestDay).toBe(false)
    expect(target.isConditionalRestDay).toBe(true)
  })
})

// ─── conditionalRestApplies ───────────────────────────────────────────────────

describe('conditionalRestApplies', () => {
  it('returns true when the previous day was completed', () => {
    expect(conditionalRestApplies(MAY, '2026-05-26', ['2026-05-25'])).toBe(true)
  })

  it('returns false when the previous day was not logged', () => {
    expect(conditionalRestApplies(MAY, '2026-05-26', [])).toBe(false)
  })

  it('returns false for a date with no conditional rest entry', () => {
    expect(conditionalRestApplies(MAY, '2026-05-01', ['2026-04-30'])).toBe(false)
  })
})

// ─── getRequiredDays ──────────────────────────────────────────────────────────

describe('getRequiredDays', () => {
  it('subtracts only fixed rest days, not conditional ones', () => {
    // May: 31 total - 1 fixed rest (May 25) = 30
    expect(getRequiredDays(MAY)).toBe(30)
  })

  it('returns full calendar total when no rest days', () => {
    expect(getRequiredDays(APR)).toBe(30)
  })
})

// ─── getMonthlyTotal with rest days ───────────────────────────────────────────

describe('getMonthlyTotal — rest day handling', () => {
  it('skips fixed rest days in escalating challenges', () => {
    const withRest: ChallengeTemplate = { ...APR, restDates: ['2026-04-15'] }
    // Day 15 = 15 × 10 = 150; removed from total
    expect(getMonthlyTotal(withRest)).toBe(getMonthlyTotal(APR) - 150)
  })

  it('computes correct total for weekly-tiers (rep exercises only, rest day excluded)', () => {
    // Week 1 (days 1-8):   8 × 90  = 720
    // Week 2 (days 9-16):  8 × 120 = 960
    // Week 3 (days 17-23): 7 × 150 = 1050
    // Week 4 (days 24-31): 8 days − May 25 (rest) = 7 × 180 = 1260
    expect(getMonthlyTotal(MAY)).toBe(720 + 960 + 1050 + 1260)
  })
})
