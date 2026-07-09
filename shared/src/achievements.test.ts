import { describe, it, expect } from 'vitest'
import type { AchievementContext, AchievementLogInput } from './achievements'
import {
  ACHIEVEMENTS,
  getAchievementById,
  evaluateAchievements,
  findNewlyEarned,
  getNextAchievements,
  nearMissLabel,
} from './achievements'

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
