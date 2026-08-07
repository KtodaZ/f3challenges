import { describe, it, expect } from 'vitest'
import {
  CHALLENGES,
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
  loadTotalLbs,
  rollupSetReps,
  badgeLoad,
  setsVolume,
  setsByWeight,
  setsByExerciseWeight,
  logSets,
  allSets,
  reconcileSets,
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

  // What past-challenge Catch Up runs on: an ended challenge's week, read
  // from a date past the challenge itself, still knows what it's short and
  // still closes out when the reps land.
  it('still scores a week after the whole challenge has ended', () => {
    const short = getWeekProgress(AUG, '2026-08-02', [log('2026-08-03', db(100))], '2026-09-15')!
    expect(short.remaining).toBe(200)
    expect(short.isComplete).toBe(false)

    const toppedUp = getWeekProgress(
      AUG, '2026-08-02',
      [log('2026-08-03', db(100)), log('2026-08-08', db(200))],
      '2026-09-15',
    )!
    expect(toppedUp.isComplete).toBe(true)
    expect(toppedUp.remaining).toBe(0)
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

  // The log pad never asks how many implements you used — it stamps
  // `loadHands` from the variation. Curls are the case that matters: a pair of
  // dumbbells or hammers, one coupon, and nothing at all on chin-ups.
  it('takes the implement count from the exercise, not the PAX', () => {
    const curls = CHALLENGES.find(c => c.type === 'weekly-cumulative')!
    const handsFor = (id: string) => {
      const ex = curls.exercises.find(e => e.id === id)!
      return ex.bodyweight ? null : ex.loadHands ?? 2
    }
    expect(handsFor('dumbbell-curl')).toBe(2)
    expect(handsFor('hammer-curl')).toBe(2)
    expect(handsFor('coupon-curl')).toBe(1)
    expect(handsFor('chin-up')).toBeNull()
    expect(formatLoad({ lbs: 60, hands: 1 })).toBe('1×60')
  })

  it('renders nothing when the weight is unset or nonsense', () => {
    expect(formatLoad(undefined)).toBeNull()
    expect(formatLoad({ lbs: 0, hands: 2 })).toBeNull()
  })

  it('measures a load by the pounds actually in play', () => {
    // A pair of 20s and one 40 lb coupon are the same 40 lb — which is what
    // makes the two comparable instead of one arbitrarily winning.
    expect(loadTotalLbs({ lbs: 20, hands: 2 })).toBe(40)
    expect(loadTotalLbs({ lbs: 40, hands: 1 })).toBe(40)
    expect(loadTotalLbs(undefined)).toBe(0)
    expect(loadTotalLbs({ bodyweight: true })).toBe(0)
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

// ─── Sets ─────────────────────────────────────────────────────────────────────

describe('sets', () => {
  const set = (reps: number, at: string, load?: { lbs: number; hands: 1 | 2 }, ex = 'dumbbell-curl') =>
    ({ exerciseId: ex, reps, at, ...(load ? { load } : {}) })

  // The scenario the whole refactor exists for.
  const twoDays = [
    set(40, '2026-08-03T14:00:00.000Z', { lbs: 20, hands: 2 }),
    set(25, '2026-08-04T14:00:00.000Z', { lbs: 40, hands: 1 }, 'coupon-curl'),
  ]

  it('rolls sets up into the reps-per-exercise the rest of the app scores on', () => {
    expect(rollupSetReps(twoDays)).toEqual({ 'dumbbell-curl': 40, 'coupon-curl': 25 })
  })

  it('counts reps as reps — weight never multiplies the score', () => {
    const heavy = [set(25, '2026-08-03T14:00:00.000Z', { lbs: 50, hands: 2 })]
    expect(rollupSetReps(heavy)['dumbbell-curl']).toBe(25)
  })

  it('totals the pounds moved', () => {
    // 40 reps × 40 lb + 25 reps × 40 lb
    expect(setsVolume(twoDays)).toBe(2600)
    expect(setsVolume([set(30, '2026-08-03T14:00:00.000Z')])).toBe(0)
  })

  describe('badgeLoad', () => {
    it('shows the weight the most reps were done at, not the last one', () => {
      const sets = [
        set(300, '2026-08-03T14:00:00.000Z', { lbs: 25, hands: 2 }),
        set(1, '2026-08-04T14:00:00.000Z', { lbs: 50, hands: 2 }), // one show-off rep
      ]
      expect(formatLoad(badgeLoad(sets))).toBe('2×25')
    })

    it('adds up reps at the same weight across days', () => {
      const sets = [
        set(30, '2026-08-03T14:00:00.000Z', { lbs: 25, hands: 2 }),
        set(40, '2026-08-04T14:00:00.000Z', { lbs: 30, hands: 2 }),
        set(30, '2026-08-05T14:00:00.000Z', { lbs: 25, hands: 2 }), // 25s now lead 60–40
      ]
      expect(formatLoad(badgeLoad(sets))).toBe('2×25')
    })

    it('breaks a tie on the heavier total', () => {
      const sets = [
        set(50, '2026-08-03T14:00:00.000Z', { lbs: 20, hands: 2 }), // 40 lb
        set(50, '2026-08-04T14:00:00.000Z', { lbs: 50, hands: 1 }), // 50 lb
      ]
      expect(formatLoad(badgeLoad(sets))).toBe('1×50')
    })

    it('ignores unweighted sets and empty lists', () => {
      expect(badgeLoad([set(30, '2026-08-03T14:00:00.000Z')])).toBeUndefined()
      expect(badgeLoad([])).toBeUndefined()
    })
  })

  describe('logSets — logs written before sets existed', () => {
    it('synthesizes one set per exercise carrying the day’s single weight', () => {
      const legacy = {
        date: '2026-08-03',
        loggedAt: '2026-08-03T14:00:00.000Z',
        load: { lbs: 25, hands: 2 as const },
        exerciseLogs: [
          { exerciseId: 'dumbbell-curl', completedReps: 40 },
          { exerciseId: 'chin-up', completedReps: 0 },
        ],
      }
      expect(logSets(legacy)).toEqual([
        { exerciseId: 'dumbbell-curl', reps: 40, load: { lbs: 25, hands: 2 }, at: '2026-08-03T14:00:00.000Z' },
      ])
    })

    it('prefers real sets when the log has them', () => {
      const log = { date: '2026-08-03', sets: twoDays, exerciseLogs: [], load: { lbs: 99 } }
      expect(logSets(log)).toBe(twoDays)
    })

    it('never invents a load the log did not have', () => {
      const legacy = {
        date: '2026-08-03',
        exerciseLogs: [{ exerciseId: 'chin-up', completedReps: 12 }],
      }
      expect(logSets(legacy)[0].load).toBeUndefined()
    })

    it('does not hand the day’s weight to a bodyweight movement', () => {
      // A legacy log holds one weight for the whole day, so synthesizing sets
      // from it would put the dumbbells on the chin-ups too.
      const legacy = {
        date: '2026-08-03',
        loggedAt: '2026-08-03T14:00:00.000Z',
        load: { lbs: 15, hands: 2 as const },
        exerciseLogs: [
          { exerciseId: 'dumbbell-curl', completedReps: 40 },
          { exerciseId: 'chin-up', completedReps: 5 },
        ],
      }
      const sets = logSets(legacy, AUG.exercises)
      expect(sets.find(s => s.exerciseId === 'dumbbell-curl')?.load).toEqual({ lbs: 15, hands: 2 })
      expect(sets.find(s => s.exerciseId === 'chin-up')?.load).toBeUndefined()
    })

    it('scrubs a bad weight already written onto a bodyweight set', () => {
      const log = {
        date: '2026-08-03',
        sets: [set(5, '2026-08-03T14:00:00.000Z', { lbs: 15, hands: 2 }, 'chin-up')],
        exerciseLogs: [],
      }
      expect(logSets(log, AUG.exercises)[0].load).toBeUndefined()
    })
  })

  describe('setsByExerciseWeight — the week mix rows', () => {
    it('splits one variation into a row per weight, heaviest first', () => {
      const rows = setsByExerciseWeight([
        set(40, '2026-08-02T14:00:00.000Z', { lbs: 15, hands: 2 }),
        set(60, '2026-08-04T14:00:00.000Z', { lbs: 20, hands: 2 }),
        set(95, '2026-08-03T14:00:00.000Z', { lbs: 30, hands: 1 }, 'coupon-curl'),
        set(5, '2026-08-05T14:00:00.000Z', undefined, 'chin-up'),
      ], AUG.exercises)

      expect(rows.map(r => [r.exerciseId, r.badge, r.reps])).toEqual([
        // Dumbbell totals 100, so both its rows sort above the 95 of coupon —
        // a bigger variation can't wedge between them.
        ['dumbbell-curl', '2×20', 60],
        ['dumbbell-curl', '2×15', 40],
        ['coupon-curl', '1×30', 95],
        ['chin-up', 'BW', 5],
      ])
    })

    it('rows sum to the header total, bodyweight included', () => {
      const rows = setsByExerciseWeight([
        set(40, '2026-08-02T14:00:00.000Z', { lbs: 15, hands: 2 }),
        set(95, '2026-08-03T14:00:00.000Z', { lbs: 30, hands: 1 }, 'coupon-curl'),
        set(5, '2026-08-05T14:00:00.000Z', undefined, 'chin-up'),
      ], AUG.exercises)
      expect(rows.reduce((s, r) => s + r.reps, 0)).toBe(140)
    })

    it('gives a bodyweight movement a BW row and no pounds, however it was logged', () => {
      const rows = setsByExerciseWeight(
        [set(5, '2026-08-05T14:00:00.000Z', { lbs: 15, hands: 2 }, 'chin-up')],
        AUG.exercises,
      )
      expect(rows).toEqual([
        { exerciseId: 'chin-up', badge: 'BW', reps: 5, volume: 0 },
      ])
    })

    it('leaves unweighted reps of a weighted movement without a badge', () => {
      const rows = setsByExerciseWeight([set(20, '2026-08-02T14:00:00.000Z')], AUG.exercises)
      expect(rows[0].badge).toBeNull()
      expect(rows[0].volume).toBe(0)
    })
  })

  describe('the by-weight tallies a bodyweight movement can’t skew', () => {
    // Reproduces what the ledger showed: a week of 40 dumbbell + 95 coupon +
    // 5 chin-up read as "2×15 → 45" because the chin-ups inherited the day's
    // dumbbells, and the 5 of them added 150 phantom lb to the pounds moved.
    const week = [
      {
        date: '2026-08-02',
        loggedAt: '2026-08-02T14:00:00.000Z',
        load: { lbs: 15, hands: 2 as const },
        exerciseLogs: [
          { exerciseId: 'dumbbell-curl', completedReps: 40 },
          { exerciseId: 'chin-up', completedReps: 5 },
        ],
      },
      {
        date: '2026-08-03',
        loggedAt: '2026-08-03T14:00:00.000Z',
        load: { lbs: 30, hands: 1 as const },
        exerciseLogs: [{ exerciseId: 'coupon-curl', completedReps: 95 }],
      },
    ]

    it('counts only the reps that actually carried weight', () => {
      const rows = setsByWeight(allSets(week, AUG.exercises))
      // A pair of 15s and a single 30 are both 30 lb, so the heaviest-first
      // sort ties and they stay in the order they were logged.
      expect(rows.map(r => [r.badge, r.reps])).toEqual([
        ['2×15', 40],
        ['1×30', 95],
      ])
    })

    it('leaves bodyweight reps out of the pounds moved', () => {
      // 40 × 30 + 95 × 30 — the 5 chin-ups move nothing.
      expect(setsVolume(allSets(week, AUG.exercises))).toBe(4050)
    })
  })

  describe('reconcileSets — writers that only know rep totals', () => {
    const at = '2026-08-03T18:00:00.000Z'

    it('leaves sets alone when the totals already agree', () => {
      expect(reconcileSets({ 'dumbbell-curl': 40, 'coupon-curl': 25 }, twoDays, at)).toEqual(twoDays)
    })

    it('appends a top-up at the weight that exercise was last done at', () => {
      // What Catch Up does: a day that was 2×20 stays 2×20.
      const out = reconcileSets({ 'dumbbell-curl': 60, 'coupon-curl': 25 }, twoDays, at)
      expect(out).toHaveLength(3)
      const added = out.find(s => s.at === at)!
      expect(added).toMatchObject({ exerciseId: 'dumbbell-curl', reps: 20, load: { lbs: 20, hands: 2 } })
      expect(rollupSetReps(out)).toEqual({ 'dumbbell-curl': 60, 'coupon-curl': 25 })
    })

    it('adds an unweighted set when the exercise has no weight to inherit', () => {
      const out = reconcileSets({ 'chin-up': 12 }, [], at)
      expect(out).toEqual([{ exerciseId: 'chin-up', reps: 12, at }])
    })

    it('trims the newest sets first when edited down', () => {
      const sets = [
        set(30, '2026-08-03T10:00:00.000Z', { lbs: 20, hands: 2 }),
        set(30, '2026-08-03T11:00:00.000Z', { lbs: 30, hands: 2 }),
      ]
      const out = reconcileSets({ 'dumbbell-curl': 45 }, sets, at)
      expect(out.map(s => s.reps)).toEqual([30, 15])
      expect(out[1].load).toEqual({ lbs: 30, hands: 2 })
    })

    it('drops an exercise zeroed out entirely', () => {
      expect(reconcileSets({ 'dumbbell-curl': 0, 'coupon-curl': 25 }, twoDays, at))
        .toEqual([twoDays[1]])
    })

    // The invariant the save path leans on: whatever a writer hands over, the
    // sets and the rollup describe the same workout.
    it('always rolls back up to the reps it was given', () => {
      const cases: Record<string, number>[] = [
        { 'dumbbell-curl': 40, 'coupon-curl': 25 },
        { 'dumbbell-curl': 100 },
        { 'dumbbell-curl': 5, 'chin-up': 7 },
        {},
      ]
      for (const reps of cases) {
        expect(rollupSetReps(reconcileSets(reps, twoDays, at)))
          .toEqual(Object.fromEntries(Object.entries(reps).filter(([, n]) => n > 0)))
      }
    })
  })

  describe('setsByWeight', () => {
    it('groups reps by weight, heaviest first, with the pounds moved', () => {
      const rows = setsByWeight([
        set(20, '2026-08-03T13:00:00.000Z', { lbs: 20, hands: 2 }),  // 40 lb
        set(25, '2026-08-03T14:00:00.000Z', { lbs: 40, hands: 1 }),  // 40 lb, different badge
        set(15, '2026-08-04T13:00:00.000Z', { lbs: 30, hands: 2 }),  // 60 lb
        set(10, '2026-08-05T13:00:00.000Z', { lbs: 20, hands: 2 }),  // folds into 2×20
      ])
      expect(rows.map(r => r.badge)).toEqual(['2×30', '2×20', '1×40'])
      expect(rows.find(r => r.badge === '2×20')).toMatchObject({ reps: 30, volume: 1200 })
      expect(rows.find(r => r.badge === '2×30')).toMatchObject({ reps: 15, volume: 900 })
    })

    it('leaves unweighted work out — "no weight" is not a weight', () => {
      expect(setsByWeight([set(30, '2026-08-03T13:00:00.000Z', undefined, 'chin-up')])).toEqual([])
    })
  })

  it('gathers every set across logs, oldest first', () => {
    const logs = [
      { date: '2026-08-04', sets: [twoDays[1]], exerciseLogs: [] },
      { date: '2026-08-03', sets: [twoDays[0]], exerciseLogs: [] },
    ]
    expect(allSets(logs).map(s => s.reps)).toEqual([40, 25])
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
