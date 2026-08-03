import { describe, it, expect } from 'vitest'
import type { AchievementContext, AchievementLogInput } from './achievements'
import {
  ACHIEVEMENTS,
  getAchievementById,
  getFeaturedAchievement,
  evaluateAchievements,
  findNewlyEarned,
  getNextAchievements,
  nearMissLabel,
  challengeBadgeDefinition,
} from './achievements'
import { getChallengeById } from './challenges'
import type { ChallengeBadgeDef } from './types'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function log(overrides: Partial<AchievementLogInput> = {}): AchievementLogInput {
  return {
    date: '2026-02-10',
    challengeId: 'feb-2026',
    completionFraction: 1,
    isMakeUp: false,
    loggedAt: '2026-02-10T18:00:00.000Z', // 10am PT
    completedReps: 100,
    targetReps: 100,
    ...overrides,
  }
}

function ctx(overrides: Partial<AchievementContext> = {}): AchievementContext {
  return { logs: [], longestStreak: 0, ...overrides }
}

/** Complete on-time logs for every day of feb-2026 (28 days, no rest days). */
function fullFebLogs(): AchievementLogInput[] {
  return Array.from({ length: 28 }, (_, i) =>
    log({ date: `2026-02-${String(i + 1).padStart(2, '0')}` })
  )
}

function progressOf(id: string, c: AchievementContext) {
  const def = getAchievementById(id)
  if (!def) throw new Error(`no achievement ${id}`)
  return def.progress(c)
}

// ─── Catalog sanity ───────────────────────────────────────────────────────────

describe('ACHIEVEMENTS catalog', () => {
  it('has unique ids', () => {
    const ids = ACHIEVEMENTS.map(a => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every achievement reports zero progress on an empty context', () => {
    for (const e of evaluateAchievements(ctx())) {
      expect(e.progress.earned).toBe(false)
      expect(e.progress.current).toBe(0)
    }
  })
})

// ─── Individual achievements ──────────────────────────────────────────────────

describe('streak achievements', () => {
  it('earn from longestStreak', () => {
    const c = ctx({ longestStreak: 7 })
    expect(progressOf('kindling', c).earned).toBe(true)
    expect(progressOf('week-of-fire', c).earned).toBe(true)
    expect(progressOf('fortnight-force', c)).toMatchObject({ earned: false, current: 7, target: 14 })
  })
})

describe('volume achievements', () => {
  it('sum completedReps across all logs, including partial days', () => {
    const c = ctx({
      logs: [
        log({ completedReps: 600 }),
        log({ date: '2026-02-11', completedReps: 500, completionFraction: 0.5 }),
      ],
    })
    expect(progressOf('first-thousand', c)).toMatchObject({ earned: true, current: 1000 })
    expect(progressOf('club-5k', c)).toMatchObject({ earned: false, current: 1100 })
  })
})

describe('comeback achievements', () => {
  it('time-traveler needs one completed makeup; phoenix needs five', () => {
    const one = ctx({ logs: [log({ isMakeUp: true })] })
    expect(progressOf('time-traveler', one).earned).toBe(true)
    expect(progressOf('phoenix', one)).toMatchObject({ earned: false, current: 1, target: 5 })

    const five = ctx({
      logs: Array.from({ length: 5 }, (_, i) =>
        log({ date: `2026-02-0${i + 1}`, isMakeUp: true })
      ),
    })
    expect(progressOf('phoenix', five).earned).toBe(true)
  })

  it('incomplete makeups do not count', () => {
    const c = ctx({ logs: [log({ isMakeUp: true, completionFraction: 0.5 })] })
    expect(progressOf('time-traveler', c).earned).toBe(false)
  })

  it('clean-slate: all makeup debt cleared, 2+ days deep', () => {
    const logs = fullFebLogs()
    logs[3] = { ...logs[3], isMakeUp: true }
    logs[9] = { ...logs[9], isMakeUp: true }
    expect(progressOf('clean-slate', ctx({ logs }))).toMatchObject({ earned: true, current: 2, target: 2 })

    // Only one makeup and nothing missed — never fell 2+ behind
    const oneMakeup = fullFebLogs()
    oneMakeup[3] = { ...oneMakeup[3], isMakeUp: true }
    expect(progressOf('clean-slate', ctx({ logs: oneMakeup })).earned).toBe(false)
  })

  it('clean-slate progress counts outstanding missed days as remaining debt', () => {
    // Days 1–20 complete (2 via makeup), days 21–28 missed → debt 10, cleared 2
    const logs = fullFebLogs().slice(0, 20)
    logs[3] = { ...logs[3], isMakeUp: true }
    logs[9] = { ...logs[9], isMakeUp: true }
    const p = progressOf('clean-slate', ctx({ logs }))
    expect(p).toMatchObject({ earned: false, current: 2, target: 10 })
  })
})

describe('timing achievements', () => {
  it('dawn-patrol counts completed days logged before 7am PT', () => {
    // 13:59 UTC = 5:59am PT (PST, February)
    const early = Array.from({ length: 10 }, (_, i) =>
      log({ date: `2026-02-${String(i + 1).padStart(2, '0')}`, loggedAt: `2026-02-${String(i + 1).padStart(2, '0')}T13:59:00.000Z` })
    )
    expect(progressOf('dawn-patrol', ctx({ logs: early })).earned).toBe(true)
    // 10am PT logs don't count
    expect(progressOf('dawn-patrol', ctx({ logs: fullFebLogs() })).current).toBe(0)
  })
})

describe('special achievements', () => {
  it('iron-month: every required day on time', () => {
    expect(progressOf('iron-month', ctx({ logs: fullFebLogs() })).earned).toBe(true)

    // One made-up day breaks the perfect month — that challenge no longer
    // counts as progress at all (the badge is impossible there)
    const withMakeup = fullFebLogs()
    withMakeup[0] = { ...withMakeup[0], isMakeUp: true }
    const p = progressOf('iron-month', ctx({ logs: withMakeup }))
    expect(p.earned).toBe(false)
    expect(p.current).toBe(0)
  })

  it('launch-day: Day 1 completed on the day, not as a makeup', () => {
    expect(progressOf('launch-day', ctx({ logs: [log({ date: '2026-02-01' })] })).earned).toBe(true)
    expect(progressOf('launch-day', ctx({ logs: [log({ date: '2026-02-01', isMakeUp: true })] })).earned).toBe(false)
    expect(progressOf('launch-day', ctx({ logs: [log({ date: '2026-02-02' })] })).earned).toBe(false)
  })

  it('overachiever: 150% of a daily target', () => {
    expect(progressOf('overachiever', ctx({ logs: [log({ completedReps: 150, targetReps: 100 })] })).earned).toBe(true)
    expect(progressOf('overachiever', ctx({ logs: [log({ completedReps: 149, targetReps: 100 })] })).earned).toBe(false)
  })

  it('first-finisher badges count firstFinisherDays from context', () => {
    expect(progressOf('first-blood', ctx({ firstFinisherDays: 1 })).earned).toBe(true)
    expect(progressOf('first-blood', ctx()).earned).toBe(false)
    expect(progressOf('pace-setter', ctx({ firstFinisherDays: 4 }))).toMatchObject({ earned: false, current: 4, target: 5 })
    expect(progressOf('pace-setter', ctx({ firstFinisherDays: 5 })).earned).toBe(true)
  })

  it('conqueror: three fully completed challenges', () => {
    // feb-2026 fully complete = 1 challenge
    expect(progressOf('conqueror', ctx({ logs: fullFebLogs() }))).toMatchObject({ earned: false, current: 1, target: 3 })
  })

  it('adapt-and-overcome: full challenge finished while status is modifying', () => {
    const logs = fullFebLogs()
    // Completed the whole challenge, but not marked as modifying → not earned
    expect(progressOf('adapt-and-overcome', ctx({ logs })).earned).toBe(false)
    // Marked modifying on that challenge → earned
    expect(progressOf('adapt-and-overcome', ctx({ logs, modifyingChallengeIds: ['feb-2026'] })).earned).toBe(true)
    // Modifying but the challenge isn't fully completed → not earned
    expect(progressOf('adapt-and-overcome', ctx({ logs: logs.slice(0, 20), modifyingChallengeIds: ['feb-2026'] })).earned).toBe(false)
    // Modifying a different challenge than the one completed → not earned
    expect(progressOf('adapt-and-overcome', ctx({ logs, modifyingChallengeIds: ['jul-2026'] })).earned).toBe(false)
  })

  it('secret badges: over-9000, surgeon, juggernaut', () => {
    expect(progressOf('over-9000', ctx({ logs: [log({ completedReps: 9001 })] })).earned).toBe(true)
    expect(progressOf('over-9000', ctx({ logs: [log({ completedReps: 9000 })] })).earned).toBe(false)

    const exactDays = Array.from({ length: 10 }, (_, i) =>
      log({ date: `2026-02-${String(i + 1).padStart(2, '0')}`, completedReps: 100, targetReps: 100 })
    )
    expect(progressOf('surgeon', ctx({ logs: exactDays })).earned).toBe(true)

    const bigDays = Array.from({ length: 5 }, (_, i) =>
      log({ date: `2026-02-${String(i + 1).padStart(2, '0')}`, completedReps: 150, targetReps: 100 })
    )
    expect(progressOf('juggernaut', ctx({ logs: bigDays })).earned).toBe(true)
    expect(progressOf('juggernaut', ctx({ logs: bigDays.slice(0, 4) })).earned).toBe(false)
  })

  it('group placement badges read context counts', () => {
    expect(progressOf('the-six', ctx({ lastFinisherDays: 5 })).earned).toBe(true)
    expect(progressOf('the-six', ctx({ lastFinisherDays: 4 }))).toMatchObject({ earned: false, current: 4 })
    expect(progressOf('photo-finish', ctx({ photoFinishDays: 1 })).earned).toBe(true)
  })

  it('same-day stack ladder counts completions finished in one PT day', () => {
    // Three days all completed on the same PT calendar day (one on-time + two makeups)
    const sameDay = '2026-02-10T20:00:00.000Z' // noon PT
    const logs = [
      log({ date: '2026-02-10', loggedAt: sameDay }),
      log({ date: '2026-02-08', isMakeUp: true, loggedAt: sameDay }),
      log({ date: '2026-02-09', isMakeUp: true, loggedAt: sameDay }),
    ]
    expect(progressOf('double-duty', ctx({ logs })).earned).toBe(true)
    expect(progressOf('triple-threat', ctx({ logs })).earned).toBe(true)
    expect(progressOf('quad-stack', ctx({ logs }))).toMatchObject({ earned: false, current: 3, target: 4 })
  })

  it('quick-rebound: makeup completed within 2 days of the missed date', () => {
    const fast = (d: string, doneIso: string) => log({ date: d, isMakeUp: true, loggedAt: doneIso })
    const logs = [
      fast('2026-02-01', '2026-02-03T20:00:00.000Z'), // 2 days later — counts
      fast('2026-02-05', '2026-02-06T20:00:00.000Z'), // next day — counts
      fast('2026-02-10', '2026-02-20T20:00:00.000Z'), // way later — doesn't
    ]
    expect(progressOf('quick-rebound', ctx({ logs }))).toMatchObject({ earned: false, current: 2, target: 3 })
    logs.push(fast('2026-02-15', '2026-02-16T20:00:00.000Z'))
    expect(progressOf('quick-rebound', ctx({ logs })).earned).toBe(true)
  })

  it('buzzer-beater: on-time completion in the last 15 minutes of its own day', () => {
    // 2026-02-10 23:50 PT = 2026-02-11 07:50 UTC
    const buzzer = log({ date: '2026-02-10', loggedAt: '2026-02-11T07:50:00.000Z' })
    expect(progressOf('buzzer-beater', ctx({ logs: [buzzer] })).earned).toBe(true)
    // 23:30 PT — too early
    const early = log({ date: '2026-02-10', loggedAt: '2026-02-11T07:30:00.000Z' })
    expect(progressOf('buzzer-beater', ctx({ logs: [early] })).earned).toBe(false)
    // Makeup at 23:50 doesn't count
    const makeup = log({ date: '2026-02-10', isMakeUp: true, loggedAt: '2026-02-11T07:50:00.000Z' })
    expect(progressOf('buzzer-beater', ctx({ logs: [makeup] })).earned).toBe(false)
  })

  it('ambassador: full roster coverage, 5+ PAX required', () => {
    expect(progressOf('ambassador', ctx({ shoutoutCoverage: { covered: 6, total: 6 } })).earned).toBe(true)
    expect(progressOf('ambassador', ctx({ shoutoutCoverage: { covered: 4, total: 6 } }))).toMatchObject({ earned: false, current: 4, target: 6 })
    // Tiny roster can't earn it
    expect(progressOf('ambassador', ctx({ shoutoutCoverage: { covered: 3, total: 3 } })).earned).toBe(false)
  })

  it('challenge signature badges generate from the template (full month)', () => {
    const machine = getAchievementById('jul-2026-machine')
    expect(machine).toBeDefined()
    const fullJuly = Array.from({ length: 31 }, (_, i) =>
      log({ date: `2026-07-${String(i + 1).padStart(2, '0')}`, challengeId: 'jul-2026' })
    )
    expect(machine!.progress(ctx({ logs: fullJuly }))).toMatchObject({ earned: true, target: 31 })
    expect(machine!.progress(ctx({ logs: fullJuly.slice(0, 25) }))).toMatchObject({ earned: false, current: 25 })
    // Logs from other challenges don't count
    expect(machine!.progress(ctx({ logs: fullFebLogs() }))).toMatchObject({ current: 0, earned: false })
  })

  it('full-house reads context count', () => {
    expect(progressOf('full-house', ctx({ fullHouseDays: 1 })).earned).toBe(true)
    expect(progressOf('full-house', ctx()).earned).toBe(false)
  })

  it('getNextAchievements rotation keeps slot 1 fixed and rotates slot 2', () => {
    // Progress on several fronts so there are 3+ candidates
    const c = ctx({
      longestStreak: 6,
      logs: [log({ completedReps: 800, targetReps: 800 })],
      commentsPosted: 10,
    })
    const a = getNextAchievements(c, 2, 1)
    const b = getNextAchievements(c, 2, 2)
    expect(a[0].def.id).toBe(b[0].def.id)       // closest stays pinned
    expect(a[1].def.id).not.toBe(b[1].def.id)   // second slot rotates with the seed
  })

  it('getFeaturedAchievement resolves the Badge of the Month', () => {
    const jul = getChallengeById('jul-2026')!
    expect(getFeaturedAchievement(jul)?.id).toBe('quick-rebound')
  })

  it('social + meta badges read context counts', () => {
    expect(progressOf('conversationalist', ctx({ commentsPosted: 25 })).earned).toBe(true)
    expect(progressOf('shot-caller', ctx({ successfulCallouts: 3 })).earned).toBe(true)
    expect(progressOf('completionist', ctx({ earnedBadgesCount: 25 })).earned).toBe(true)
    expect(progressOf('completionist', ctx({ earnedBadgesCount: 12 }))).toMatchObject({ earned: false, current: 12, target: 25 })
  })

  it('feed media badges read photo/video counts', () => {
    // Photos
    expect(progressOf('pics-or-it-didnt-happen', ctx({ photosUploaded: 1 })).earned).toBe(true)
    expect(progressOf('pics-or-it-didnt-happen', ctx({ photosUploaded: 0 })).earned).toBe(false)
    expect(progressOf('shutterbug', ctx({ photosUploaded: 5 })).earned).toBe(true)
    expect(progressOf('shutterbug', ctx({ photosUploaded: 4 }))).toMatchObject({ earned: false, current: 4, target: 5 })
    // Videos
    expect(progressOf('lights-camera-merkin', ctx({ videosUploaded: 1 })).earned).toBe(true)
    expect(progressOf('lights-camera-merkin', ctx({ videosUploaded: 0 })).earned).toBe(false)
    expect(progressOf('directors-cut', ctx({ videosUploaded: 3 })).earned).toBe(true)
    expect(progressOf('directors-cut', ctx({ videosUploaded: 2 }))).toMatchObject({ earned: false, current: 2, target: 3 })
    // Counts don't cross-contaminate
    expect(progressOf('lights-camera-merkin', ctx({ photosUploaded: 10 })).earned).toBe(false)
  })

  it('bonus-hunter needs every bonus week', () => {
    expect(progressOf('bonus-hunter', ctx({ bonusWeeks: { completed: 2, total: 2 } })).earned).toBe(true)
    expect(progressOf('bonus-hunter', ctx({ bonusWeeks: { completed: 1, total: 2 } })).earned).toBe(false)
    expect(progressOf('bonus-hunter', ctx()).earned).toBe(false)
  })
})

// ─── Engine ───────────────────────────────────────────────────────────────────

describe('findNewlyEarned', () => {
  it('excludes already-persisted achievements', () => {
    const c = ctx({ longestStreak: 3 })
    expect(findNewlyEarned(c, []).map(d => d.id)).toContain('kindling')
    expect(findNewlyEarned(c, [{ id: 'kindling', awardedAt: '2026-02-01T00:00:00Z' }])).toHaveLength(0)
  })
})

describe('getNextAchievements', () => {
  it('skips secret and zero-progress achievements', () => {
    const next = getNextAchievements(ctx({ longestStreak: 2 }), 10)
    expect(next.map(e => e.def.id)).not.toContain('night-owl')
    expect(next.every(e => e.progress.current > 0)).toBe(true)
  })

  it('only advertises the next unearned tier of a chain', () => {
    const next = getNextAchievements(ctx({ longestStreak: 5 }), 10)
    const streakIds = next.filter(e => e.def.chain === 'streak').map(e => e.def.id)
    expect(streakIds).toEqual(['week-of-fire']) // kindling earned, 14/21 gated behind 7
  })

  it('sorts by completion ratio, closest first', () => {
    const c = ctx({
      longestStreak: 6, // week-of-fire at 6/7
      logs: [log({ completedReps: 100, targetReps: 100 })], // first-thousand at 100/1000
    })
    const next = getNextAchievements(c, 2)
    expect(next[0].def.id).toBe('week-of-fire')
  })
})

describe('nearMissLabel', () => {
  it('formats remaining count with singularized unit', () => {
    const c = ctx({ longestStreak: 6 })
    const e = getNextAchievements(c, 1)[0]
    expect(nearMissLabel(e)).toBe('1 day away')
  })
})

// ─── Weight-aware challenge badges ────────────────────────────────────────────
// Nothing ships with these criteria yet — they exist so a future challenge can
// declare "move 50,000 lb" or "500 reps at 40 lb+" as pure data.

describe('weight-aware badge criteria', () => {
  const AUG = getChallengeById('aug-2026')!

  const badge = (criteria: ChallengeBadgeDef['criteria']) =>
    challengeBadgeDefinition(AUG, {
      id: 'test-badge', name: 'Test', emoji: '🏋', description: '', howTo: '', criteria,
    })

  const augLog = (sets: AchievementLogInput['sets']) =>
    log({ date: '2026-08-03', challengeId: 'aug-2026', sets })

  const pair25 = { lbs: 25, hands: 2 as const }   // 50 lb
  const coupon40 = { lbs: 40, hands: 1 as const } // 40 lb

  it('totals pounds moved across the challenge', () => {
    const c = ctx({ logs: [
      augLog([{ exerciseId: 'dumbbell-curl', reps: 40, load: pair25, at: '2026-08-03T14:00:00.000Z' }]),
      augLog([{ exerciseId: 'coupon-curl', reps: 25, load: coupon40, at: '2026-08-04T14:00:00.000Z' }]),
    ] })
    // 40×50 + 25×40 = 3,000 of a 10,000 lb badge
    expect(badge({ type: 'volume-lbs', lbs: 10000 }).progress(c).current).toBe(3000)
  })

  it('counts reps at or above a weight on the total in play', () => {
    const c = ctx({ logs: [augLog([
      { exerciseId: 'dumbbell-curl', reps: 30, load: pair25, at: '2026-08-03T14:00:00.000Z' },   // 50 lb ✓
      { exerciseId: 'coupon-curl', reps: 20, load: coupon40, at: '2026-08-03T15:00:00.000Z' },   // 40 lb ✓
      { exerciseId: 'dumbbell-curl', reps: 99, load: { lbs: 15, hands: 2 }, at: '2026-08-03T16:00:00.000Z' }, // 30 lb ✗
      { exerciseId: 'chin-up', reps: 50, at: '2026-08-03T17:00:00.000Z' },                        // unweighted ✗
    ]) ] })
    expect(badge({ type: 'reps-at-or-above', lbs: 40, reps: 100 }).progress(c).current).toBe(50)
  })

  it('sits at zero when logs carry no sets', () => {
    const c = ctx({ logs: [log({ date: '2026-08-03', challengeId: 'aug-2026' })] })
    expect(badge({ type: 'volume-lbs', lbs: 10000 }).progress(c).current).toBe(0)
    expect(badge({ type: 'volume-lbs', lbs: 10000 }).progress(c).earned).toBe(false)
  })
})
