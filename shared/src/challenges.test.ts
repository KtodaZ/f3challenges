import { describe, it, expect } from 'vitest'
import type { ChallengeTemplate } from './types'
import {
  getChallengeForDate,
  getChallengeById,
  challengesForRegion,
  challengeBelongsToRegion,
  getDayNumber,
  getDailyTarget,
  getMonthlyTotal,
  getRequiredDays,
  getTotalDays,
  isRestDay,
  conditionalRestApplies,
  repsFractionLabel,
  getChallengeDates,
  getWeekStartPT,
  getCurrentWeekDates,
  ptDateOf,
  daysMissedBetween,
  completionContext,
  paxPassed,
  expectedBonusWeeks,
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
    expect(getChallengeForDate('2026-04-01', 'bedrock')?.id).toBe('apr-2026')
  })

  it('returns the matching challenge on the last day', () => {
    expect(getChallengeForDate('2026-04-30', 'bedrock')?.id).toBe('apr-2026')
  })

  it('returns undefined the day before April starts (March challenge already ended)', () => {
    // March ends on 2026-03-31, April starts on 2026-04-01, so there is no gap.
    // Use a date before any challenge exists at all.
    expect(getChallengeForDate('2025-12-31', 'bedrock')).toBeUndefined()
  })

  it('returns the march challenge for a march date', () => {
    expect(getChallengeForDate('2026-03-15', 'bedrock')?.id).toBe('mar-2026')
  })

  it('returns undefined for a date with no challenge', () => {
    expect(getChallengeForDate('2025-01-01', 'bedrock')).toBeUndefined()
  })
})

// ─── Region scoping ───────────────────────────────────────────────────────────

describe('region scoping', () => {
  it('treats a challenge with no regionIds as Bedrock-only', () => {
    // Every pre-multi-region challenge relies on this — none of them were
    // edited to add regionIds.
    expect(getChallengeForDate('2026-04-15', 'bedrock')?.id).toBe('apr-2026')
    expect(getChallengeForDate('2026-04-15', 'sactown')).toBeUndefined()
  })

  it('gives each region its own challenge over the same dates', () => {
    const bedrock = getChallengeForDate('2026-08-15', 'bedrock')
    const sactown = getChallengeForDate('2026-08-15', 'sactown')
    expect(bedrock?.id).toBe('aug-2026')
    expect(sactown?.id).toBe('aug-2026-sactown')
  })

  it('challengesForRegion excludes other regions', () => {
    const ids = challengesForRegion('sactown').map(c => c.id)
    expect(ids).toContain('aug-2026-sactown')
    expect(ids).not.toContain('apr-2026')
    expect(ids).not.toContain('aug-2026')
  })

  it('a challenge listing both regions belongs to both', () => {
    const shared: ChallengeTemplate = {
      id: 'x', name: 'X', hashtag: '#X', tagline: '', month: 1, year: 2027,
      regionIds: ['bedrock', 'sactown'],
      startDate: '2027-01-01', endDate: '2027-01-31',
      exercises: [{ id: 'merkin', name: 'Merkin', shortName: 'Merkin' }],
    }
    expect(challengeBelongsToRegion(shared, 'bedrock')).toBe(true)
    expect(challengeBelongsToRegion(shared, 'sactown')).toBe(true)
    expect(challengeBelongsToRegion(shared, 'nope')).toBe(false)
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

// ─── Weekly scoping ───────────────────────────────────────────────────────────

describe('getWeekStartPT', () => {
  it('returns the same date when it is already the week-start (Sunday)', () => {
    // 2026-07-26 is a Sunday
    expect(getWeekStartPT('2026-07-26')).toBe('2026-07-26')
  })

  it('snaps back to the preceding Sunday', () => {
    // 2026-07-27 (Mon) … 2026-08-01 (Sat) all belong to the week starting 07-26
    expect(getWeekStartPT('2026-07-27')).toBe('2026-07-26')
    expect(getWeekStartPT('2026-07-30')).toBe('2026-07-26')
    expect(getWeekStartPT('2026-08-01')).toBe('2026-07-26')
  })

  it('honors a Monday week start', () => {
    // With weekStartsOn=1, Monday 07-27 is itself the start
    expect(getWeekStartPT('2026-07-27', 1)).toBe('2026-07-27')
    expect(getWeekStartPT('2026-07-26', 1)).toBe('2026-07-20')
  })
})

const JUL: ChallengeTemplate = {
  id: 'jul-test',
  name: 'July Test',
  hashtag: '#JulyTest',
  tagline: 'Test',
  month: 7,
  year: 2026,
  startDate: '2026-07-01',
  endDate: '2026-07-31',
  exercises: [{ id: 'merkin', name: 'Merkin', shortName: 'Merkin' }],
}

describe('getCurrentWeekDates', () => {
  it('returns only the in-challenge, on-or-before-today dates of the current week', () => {
    // Week of 2026-07-26 (Sun) through today 2026-07-29 (Wed), all inside July FFC
    const dates = getCurrentWeekDates(JUL, '2026-07-29')
    expect(dates).toEqual(['2026-07-26', '2026-07-27', '2026-07-28', '2026-07-29'])
  })

  it('clips to the challenge window at the start of a challenge', () => {
    // Challenge starts 2026-07-01 (Wed); the week began 2026-06-28 (Sun) but
    // only in-challenge dates count.
    const dates = getCurrentWeekDates(JUL, '2026-07-02')
    expect(dates).toEqual(['2026-07-01', '2026-07-02'])
  })
})

// ─── ptDateOf ─────────────────────────────────────────────────────────────────

describe('ptDateOf', () => {
  it('returns the PT calendar date of an ISO timestamp', () => {
    expect(ptDateOf('2026-07-15T18:00:00.000Z')).toBe('2026-07-15')
  })

  it('rolls back a day for UTC timestamps that are still "yesterday" in PT', () => {
    // 01:30 UTC on the 16th is 18:30 PT on the 15th
    expect(ptDateOf('2026-07-16T01:30:00.000Z')).toBe('2026-07-15')
  })

  it('returns null for missing or unparseable input', () => {
    expect(ptDateOf(undefined)).toBeNull()
    expect(ptDateOf('')).toBeNull()
    expect(ptDateOf('not a date')).toBeNull()
  })
})

// ─── daysMissedBetween ────────────────────────────────────────────────────────

describe('daysMissedBetween', () => {
  it('counts nothing when the days are adjacent', () => {
    expect(daysMissedBetween(APR, '2026-04-10', '2026-04-11')).toBe(0)
  })

  it('counts the days strictly between, excluding both ends', () => {
    // 11th–14th missed
    expect(daysMissedBetween(APR, '2026-04-10', '2026-04-15')).toBe(4)
  })

  it('does not count rest days against a PAX', () => {
    // 24th, 26th missed — the 25th is a rest day
    expect(daysMissedBetween(MAY, '2026-05-23', '2026-05-27')).toBe(2)
  })

  it('ignores dates outside the challenge window', () => {
    expect(daysMissedBetween(APR, '2026-03-20', '2026-04-03')).toBe(2)
  })

  it('returns 0 when the dates are equal or reversed', () => {
    expect(daysMissedBetween(APR, '2026-04-10', '2026-04-10')).toBe(0)
    expect(daysMissedBetween(APR, '2026-04-15', '2026-04-10')).toBe(0)
  })
})

// ─── completionContext ────────────────────────────────────────────────────────

describe('completionContext', () => {
  // Noon PT on the given date, expressed as the UTC instant Firestore stores.
  const noonPT = (date: string) => `${date}T19:00:00.000Z`
  const log = (date: string, finishedOn: string, fraction = 1) => ({
    completionFraction: fraction,
    loggedAt: noonPT(finishedOn),
    date,
  })

  it('counts every day finished today, however old the day itself is', () => {
    // Today they did Day 28 plus makeups of Days 20 and 21
    const logs = [
      log('2026-04-28', '2026-04-28'),
      log('2026-04-20', '2026-04-28'),
      log('2026-04-21', '2026-04-28'),
      log('2026-04-27', '2026-04-27'),
    ]
    expect(completionContext(APR, logs, '2026-04-28').stackedDays).toBe(3)
  })

  it('ignores partial days', () => {
    const logs = [log('2026-04-28', '2026-04-28'), log('2026-04-27', '2026-04-28', 0.5)]
    expect(completionContext(APR, logs, '2026-04-28').stackedDays).toBe(1)
  })

  it('prefers completedAt over the other timestamps', () => {
    const logs = [{
      completionFraction: 1,
      loggedAt: noonPT('2026-04-20'),
      updatedAt: noonPT('2026-04-25'),
      completedAt: noonPT('2026-04-28'),
    }]
    expect(completionContext(APR, logs, '2026-04-28').stackedDays).toBe(1)
  })

  it('reports no gap for a PAX who logged yesterday', () => {
    const logs = [log('2026-04-27', '2026-04-27')]
    expect(completionContext(APR, logs, '2026-04-28').daysAway).toBe(0)
  })

  it('measures the gap from when they were last active', () => {
    // Last finished anything on the 22nd — 23rd through 27th missed
    const logs = [log('2026-04-22', '2026-04-22')]
    expect(completionContext(APR, logs, '2026-04-28').daysAway).toBe(5)
  })

  it('does not call someone absent for backfilling old days recently', () => {
    // They were away for ages but spent yesterday making up Day 3 — the log's
    // own date is ancient, yet they were active yesterday.
    const logs = [log('2026-04-03', '2026-04-27')]
    expect(completionContext(APR, logs, '2026-04-28').daysAway).toBe(0)
  })

  it('reports no gap for a PAX who has never completed a day', () => {
    expect(completionContext(APR, [], '2026-04-28').daysAway).toBe(0)
    expect(completionContext(APR, [log('2026-04-27', '2026-04-27', 0.4)], '2026-04-28').daysAway).toBe(0)
  })

  it('skips rest days when measuring the gap', () => {
    // Active on the 23rd, today is the 27th: 24th and 26th count, 25th rests
    const logs = [log('2026-05-23', '2026-05-23')]
    expect(completionContext(MAY, logs, '2026-05-27').daysAway).toBe(2)
  })

  it('tolerates logs with no timestamps at all', () => {
    const logs = [{ completionFraction: 1 }]
    expect(completionContext(APR, logs, '2026-04-28')).toEqual({ stackedDays: 0, daysAway: 0 })
  })
})

// ─── paxPassed ────────────────────────────────────────────────────────────────

describe('paxPassed', () => {
  const board = [
    { id: 'a', name: 'Airmail',   reps: 500 },
    { id: 'b', name: 'Big Daddy', reps: 420 },
    { id: 'c', name: 'Snuggles',  reps: 400 },
    { id: 'm', name: 'Splice',    reps: 380 },
    { id: 'd', name: 'Doc',       reps: 300 },
  ]

  it('returns everyone the mover jumped, nearest first', () => {
    // 380 → 450 clears Snuggles (400) and Big Daddy (420) but not Airmail (500)
    expect(paxPassed(board, 'm', 380, 450).map(p => p.name)).toEqual(['Big Daddy', 'Snuggles'])
  })

  it('returns nothing when the mover stayed put in the order', () => {
    expect(paxPassed(board, 'm', 380, 395)).toEqual([])
  })

  it('counts breaking a tie as a pass', () => {
    expect(paxPassed(board, 'm', 400, 410).map(p => p.name)).toEqual(['Snuggles'])
  })

  it('never reports the mover passing themselves', () => {
    expect(paxPassed(board, 'm', 100, 600).map(p => p.id)).not.toContain('m')
  })

  it('returns nothing when the total did not move or went backwards', () => {
    expect(paxPassed(board, 'm', 380, 380)).toEqual([])
    expect(paxPassed(board, 'm', 450, 380)).toEqual([])
  })

  it('handles passing the whole board', () => {
    expect(paxPassed(board, 'm', 0, 9999)).toHaveLength(4)
  })
})

// ─── expectedBonusWeeks ───────────────────────────────────────────────────────

// Weekly-cumulative month with a bonus announced for the first full week only —
// the shape the real challenge has mid-month, since rounds get added late.
const BONUS: ChallengeTemplate = {
  id: 'bonus-2026',
  name: 'Bonus Test',
  hashtag: '#Bonus',
  tagline: 'Test',
  month: 8,
  year: 2026,
  type: 'weekly-cumulative',
  startDate: '2026-08-01',
  endDate: '2026-08-31',
  weekStartsOn: 0,
  exercises: [{ id: 'curl', name: 'Curl', shortName: 'Curl' }],
  weeks: [
    { startDate: '2026-08-01', endDate: '2026-08-01', target: 50 },
    { startDate: '2026-08-02', endDate: '2026-08-08', target: 300 },
    { startDate: '2026-08-09', endDate: '2026-08-15', target: 300 },
    { startDate: '2026-08-16', endDate: '2026-08-22', target: 300 },
    { startDate: '2026-08-23', endDate: '2026-08-29', target: 300 },
    { startDate: '2026-08-30', endDate: '2026-08-31', target: 100 },
  ],
  bonusChallenge: {
    name: 'Bonus Round',
    weeks: [
      { startDate: '2026-08-02', endDate: '2026-08-08', description: 'Rows' },
    ],
  },
}

const withBonusWeeks = (weeks: { startDate: string; endDate: string }[]): ChallengeTemplate => ({
  ...BONUS,
  bonusChallenge: {
    name: 'Bonus Round',
    weeks: weeks.map(w => ({ ...w, description: 'Test' })),
  },
})

describe('expectedBonusWeeks', () => {
  it('assumes a bonus for every week still to come', () => {
    // Round 1 declared; the four weeks from Aug 9 on are assumed to get one
    expect(expectedBonusWeeks(BONUS, '2026-08-09')).toBe(5)
  })

  it('does not double-count a week once its bonus is announced', () => {
    const c = withBonusWeeks([
      { startDate: '2026-08-02', endDate: '2026-08-08' },
      { startDate: '2026-08-09', endDate: '2026-08-15' },
    ])
    expect(expectedBonusWeeks(c, '2026-08-09')).toBe(5)
  })

  it('settles on what was actually declared once the challenge ends', () => {
    expect(expectedBonusWeeks(BONUS, '2026-09-01')).toBe(1)
  })

  it('still projects a round on the final day of the challenge', () => {
    // Aug 30-31 has no bonus yet, so it is still assumed to be coming
    expect(expectedBonusWeeks(BONUS, '2026-08-31')).toBe(2)
  })

  it('counts only the declared rounds when the last week already has one', () => {
    const c = withBonusWeeks([
      { startDate: '2026-08-02', endDate: '2026-08-08' },
      { startDate: '2026-08-30', endDate: '2026-08-31' },
    ])
    expect(expectedBonusWeeks(c, '2026-08-30')).toBe(2)
  })

  it('assumes one more round for a running challenge with no weeks', () => {
    const c: ChallengeTemplate = {
      ...APR,
      bonusChallenge: {
        name: 'Bonus Round',
        weeks: [{ startDate: '2026-04-06', endDate: '2026-04-12', description: 'Test' }],
      },
    }
    expect(expectedBonusWeeks(c, '2026-04-15')).toBe(2)
    expect(expectedBonusWeeks(c, '2026-05-01')).toBe(1)
  })

  it('is zero for a challenge that never had a bonus, running or not', () => {
    expect(expectedBonusWeeks(FEB, '2026-02-10')).toBe(0)
    expect(expectedBonusWeeks(FEB, '2026-03-01')).toBe(0)
  })
})
