import { describe, it, expect } from 'vitest'
import {
  getChallengeById,
  getChallengeWeek,
  getChallengeWeeks,
  getChallengeRepTotal,
  getWeekProgress,
  getWeeksCompleted,
  getWeekStreak,
  getWeeklyHistory,
  getDailyTarget,
  getMonthlyTotal,
  isWeeklyCumulative,
  formatLoad,
  latestLoad,
  weekCompleteFeedPost,
} from './challenges'
import { getTrophyUnit, getTrophyProgress, getTrophyTier, tierAmountRequired } from './trophies'
import { getAchievementById } from './achievements'
import type { AchievementContext } from './achievements'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const AUG = getChallengeById('aug-2026')!

/** A log with reps spread across exercises. */
function log(date: string, reps: Record<string, number>) {
  return {
    date,
    challengeId: 'aug-2026',
    completionFraction: Object.values(reps).some(n => n > 0) ? 1 : 0,
    isMakeUp: false,
    completedReps: Object.values(reps).reduce((s, n) => s + n, 0),
    targetReps: 0,
    exerciseReps: reps,
    exerciseLogs: Object.entries(reps).map(([exerciseId, completedReps]) => ({
      exerciseId,
      completedReps,
    })),
  }
}

const db = (n: number) => ({ 'dumbbell-curl': n })

// ─── Week layout ──────────────────────────────────────────────────────────────

describe('August 2026 week layout', () => {
  it('is a weekly-cumulative challenge', () => {
    expect(isWeeklyCumulative(AUG)).toBe(true)
  })

  it('runs Sunday → Saturday with short weeks at both ends', () => {
    const weeks = getChallengeWeeks(AUG)
    expect(weeks).toHaveLength(6)
    // Aug 1 2026 is a Saturday — a one-day opening week.
    expect(weeks[0]).toMatchObject({ startDate: '2026-08-01', endDate: '2026-08-01', dayCount: 1, target: 50 })
    expect(weeks[1]).toMatchObject({ startDate: '2026-08-02', endDate: '2026-08-08', dayCount: 7, target: 300 })
    // Aug 31 is a Monday — a two-day closing week.
    expect(weeks[5]).toMatchObject({ startDate: '2026-08-30', endDate: '2026-08-31', dayCount: 2, target: 100 })
  })

  it('prices short weeks at the same 50/day as a full one', () => {
    for (const w of getChallengeWeeks(AUG)) {
      const perDay = w.dayCount === 7 ? w.target / 6 : w.target / w.dayCount
      expect(perDay).toBe(50) // full weeks bake in one rest day
    }
  })

  it('totals 1,350 reps for the month', () => {
    expect(getChallengeRepTotal(AUG)).toBe(1350)
    expect(getMonthlyTotal(AUG)).toBe(1350)
  })

  it('finds the week containing a date', () => {
    expect(getChallengeWeek(AUG, '2026-08-01')?.index).toBe(1)
    expect(getChallengeWeek(AUG, '2026-08-02')?.index).toBe(2)
    expect(getChallengeWeek(AUG, '2026-08-08')?.index).toBe(2)
    expect(getChallengeWeek(AUG, '2026-08-09')?.index).toBe(3)
    expect(getChallengeWeek(AUG, '2026-09-01')).toBeUndefined()
  })
})

// ─── Daily target ─────────────────────────────────────────────────────────────

describe('daily target on a weekly-cumulative challenge', () => {
  it('is open-ended with no daily quota', () => {
    const t = getDailyTarget(AUG, '2026-08-05')!
    expect(t.isOpenEnded).toBe(true)
    expect(t.totalReps).toBe(0)
    // Every movement is still listed so rep entry knows the menu.
    expect(t.exercises).toHaveLength(4)
    expect(t.exercises.every(e => e.reps === 0)).toBe(true)
  })
})

// ─── Week progress ────────────────────────────────────────────────────────────

describe('getWeekProgress', () => {
  it('sums only the reps inside the week', () => {
    const logs = [log('2026-08-01', db(50)), log('2026-08-03', db(80)), log('2026-08-05', db(40))]
    const p = getWeekProgress(AUG, '2026-08-05', logs, '2026-08-05')!
    expect(p.week.index).toBe(2)
    expect(p.reps).toBe(120) // Aug 1 belongs to week 1
    expect(p.target).toBe(300)
    expect(p.remaining).toBe(180)
    expect(p.isComplete).toBe(false)
  })

  it('counts days left inclusive of today and paces off them', () => {
    const p = getWeekProgress(AUG, '2026-08-05', [log('2026-08-03', db(100))], '2026-08-05')!
    expect(p.daysLeft).toBe(4)          // Wed 5th through Sat 8th
    expect(p.perDayNeeded).toBe(50)     // 200 remaining / 4 days
  })

  it('caps the fraction and stops asking once the target is hit', () => {
    const p = getWeekProgress(AUG, '2026-08-04', [log('2026-08-03', db(400))], '2026-08-04')!
    expect(p.isComplete).toBe(true)
    expect(p.fraction).toBe(1)
    expect(p.remaining).toBe(0)
    expect(p.perDayNeeded).toBe(0)
  })

  it('reports no days left once the week has closed', () => {
    const p = getWeekProgress(AUG, '2026-08-02', [log('2026-08-03', db(100))], '2026-08-20')!
    expect(p.daysLeft).toBe(0)
    expect(p.perDayNeeded).toBe(0)
    expect(p.remaining).toBe(200)
  })
})

// ─── Weeks completed + streak ─────────────────────────────────────────────────

describe('weeks completed', () => {
  const logs = [
    log('2026-08-01', db(50)),   // week 1 ✓ (target 50)
    log('2026-08-03', db(300)),  // week 2 ✓
    log('2026-08-10', db(120)),  // week 3 ✗
    log('2026-08-17', db(300)),  // week 4 ✓
  ]

  it('counts only weeks that reached target', () => {
    expect(getWeeksCompleted(AUG, '2026-08-22', logs)).toBe(3)
  })

  it('ignores weeks that have not started', () => {
    expect(getWeeklyHistory(AUG, '2026-08-05', logs)).toHaveLength(2)
  })

  it('breaks the streak on a closed short week', () => {
    // Weeks 1,2 ✓ · 3 ✗ · 4 ✓ → the streak counts back from week 4 only.
    expect(getWeekStreak(AUG, '2026-08-22', logs)).toBe(1)
  })

  it('does not let the week in progress break a streak', () => {
    // Week 3 is still running and empty — weeks 1 and 2 still stand.
    const early = [log('2026-08-01', db(50)), log('2026-08-03', db(300))]
    expect(getWeekStreak(AUG, '2026-08-10', early)).toBe(2)
  })
})

// ─── Trophies ─────────────────────────────────────────────────────────────────

describe('trophies on a weekly-cumulative challenge', () => {
  it('scores in reps, not days', () => {
    const unit = getTrophyUnit(AUG)
    expect(unit.unit).toBe('rep')
    expect(unit.required).toBe(1350)
  })

  it('puts the rungs at 50% / 75% / 100% of the month', () => {
    expect(tierAmountRequired(AUG, 'bronze')).toBe(675)
    expect(tierAmountRequired(AUG, 'silver')).toBe(1013) // ceil(1350 * 0.75)
    expect(tierAmountRequired(AUG, 'gold')).toBe(1350)
  })

  it('reports progress toward the next rung in reps', () => {
    const p = getTrophyProgress(AUG, 700)
    expect(p.earned?.tier).toBe('bronze')
    expect(p.next?.tier).toBe('silver')
    expect(p.toNext).toBe(313)
    expect(p.unit.many).toBe('reps')
  })

  it('wears the Bedrock Bicep theme', () => {
    expect(getTrophyTier('gold', AUG).label).toBe('Gold Bicep')
    expect(getTrophyTier('gold', AUG).emoji).toContain('💪')
    // Other challenges keep the plain medals.
    const feb = getChallengeById('feb-2026')!
    expect(getTrophyTier('gold', feb).label).toBe('Gold')
  })
})

// ─── Load ─────────────────────────────────────────────────────────────────────

describe('load badges', () => {
  it('formats a pair, a single, a coupon and bodyweight', () => {
    expect(formatLoad({ lbs: 25, hands: 2 })).toBe('2×25')
    expect(formatLoad({ lbs: 35, hands: 1 })).toBe('1×35')
    expect(formatLoad({ lbs: 65 })).toBe('65 lb')
    expect(formatLoad({ bodyweight: true })).toBe('BW')
  })

  it('renders nothing when the weight is unset or nonsense', () => {
    expect(formatLoad(undefined)).toBeNull()
    expect(formatLoad({ lbs: 0, hands: 2 })).toBeNull()
  })

  it('picks the most recent weight regardless of log order', () => {
    const logs = [
      { date: '2026-08-03', load: { lbs: 20, hands: 2 as const } },
      { date: '2026-08-09', load: { lbs: 30, hands: 2 as const } },
      { date: '2026-08-05', load: { lbs: 25, hands: 2 as const } },
    ]
    expect(formatLoad(latestLoad(logs))).toBe('2×30')
    expect(latestLoad([{ date: '2026-08-01' }])).toBeUndefined()
  })
})

// ─── Feed copy ────────────────────────────────────────────────────────────────

describe('week completion feed post', () => {
  const week = getWeekProgress(AUG, '2026-08-04', [log('2026-08-03', db(300))], '2026-08-04')!

  it('names the PAX, the week and the hashtag', () => {
    const post = weekCompleteFeedPost({ name: 'Milkman', challenge: AUG, week })
    expect(post).toContain('@Milkman')
    expect(post).toContain('#BedrockBicep')
    expect(post).toMatch(/Week 2|300/)
  })

  it('flags a make-up rather than claiming it was on time', () => {
    const post = weekCompleteFeedPost({ name: 'Milkman', challenge: AUG, week, isMakeUp: true })
    expect(post).toMatch(/went back|topped up|refused/)
  })
})

// ─── August badges ────────────────────────────────────────────────────────────

function ctx(logs: ReturnType<typeof log>[]): AchievementContext {
  return { logs, longestStreak: 0 }
}

function progressOf(id: string, c: AchievementContext) {
  const def = getAchievementById(id)
  if (!def) throw new Error(`no achievement ${id}`)
  return def.progress(c)
}

describe('Bedrock Bicep badges', () => {
  it('Century Curl wants 100 reps in one day', () => {
    expect(progressOf('aug-2026-century-curl', ctx([log('2026-08-03', db(99))])).earned).toBe(false)
    expect(progressOf('aug-2026-century-curl', ctx([log('2026-08-03', db(100))])).earned).toBe(true)
    // Spread across days doesn't count — it's a single-day badge.
    expect(progressOf(
      'aug-2026-century-curl',
      ctx([log('2026-08-03', db(60)), log('2026-08-04', db(60))]),
    ).earned).toBe(false)
  })

  it('Chin Music counts only chin-ups', () => {
    expect(progressOf('aug-2026-chin-music', ctx([log('2026-08-03', db(500))])).earned).toBe(false)
    expect(progressOf('aug-2026-chin-music', ctx([
      log('2026-08-03', { 'chin-up': 60 }),
      log('2026-08-10', { 'chin-up': 40 }),
    ])).earned).toBe(true)
  })

  it('Four-Way Flex needs all four variations inside one week', () => {
    const spreadAcrossWeeks = ctx([
      log('2026-08-03', { 'dumbbell-curl': 10, 'coupon-curl': 10 }),
      log('2026-08-10', { 'hammer-curl': 10, 'chin-up': 10 }),
    ])
    expect(progressOf('aug-2026-four-way-flex', spreadAcrossWeeks).earned).toBe(false)

    const oneWeek = ctx([
      log('2026-08-03', { 'dumbbell-curl': 10, 'coupon-curl': 10 }),
      log('2026-08-05', { 'hammer-curl': 10, 'chin-up': 10 }),
    ])
    expect(progressOf('aug-2026-four-way-flex', oneWeek).earned).toBe(true)
  })

  it('Ahead of the Curl needs the week done with 2 days to spare', () => {
    // Week 2 runs Aug 2–8; finishing on the 7th leaves only 1 day.
    expect(progressOf('aug-2026-ahead-of-the-curl', ctx([log('2026-08-07', db(300))])).earned).toBe(false)
    // Done by the 6th → the 7th and 8th are still on the clock.
    expect(progressOf('aug-2026-ahead-of-the-curl', ctx([log('2026-08-06', db(300))])).earned).toBe(true)
  })

  it('Sleeve Buster wants 2,000 reps — well past the finish line', () => {
    expect(progressOf('aug-2026-sleeve-buster', ctx([log('2026-08-03', db(1350))])).earned).toBe(false)
    expect(progressOf('aug-2026-sleeve-buster', ctx([log('2026-08-03', db(2000))])).earned).toBe(true)
  })
})
