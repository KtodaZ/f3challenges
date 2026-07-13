import { describe, it, expect } from 'vitest'
import type { Exercise } from './types'
import { getChallengeById, getDailyTarget } from './challenges'
import {
  exercisePlural,
  formatDuration,
  getRemainingExercises,
  formatRemainingWork,
  getRemainingNudge,
  remainingLabel,
} from './remaining'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const JUL = getChallengeById('jul-2026')!
const JUL_TARGET = getDailyTarget(JUL, '2026-07-13')!

function logs(entries: Record<string, number>) {
  return Object.entries(entries).map(([exerciseId, completedReps]) => ({ exerciseId, completedReps }))
}

/** Logs that fully complete every July exercise except the given ids. */
function allDoneExcept(...except: string[]) {
  return JUL_TARGET.exercises
    .filter(({ exercise }) => !except.includes(exercise.id))
    .map(({ exercise, reps }) => ({ exerciseId: exercise.id, completedReps: reps }))
}

// ─── exercisePlural ───────────────────────────────────────────────────────────

describe('exercisePlural', () => {
  const ex = (name: string, plural?: string): Exercise => ({ id: 'x', name, shortName: 'X', plural })

  it('lowercases and pluralizes plain names', () => {
    expect(exercisePlural(ex('Incline Merkin'))).toBe('incline merkins')
    expect(exercisePlural(ex('Pull-Up'))).toBe('pull-ups')
  })

  it('handles -ch endings', () => {
    expect(exercisePlural(ex('Little Baby Crunch'))).toBe('little baby crunches')
  })

  it('strips parentheticals', () => {
    expect(exercisePlural(ex('Lunge (2:1)'))).toBe('lunges')
  })

  it('prefers an explicit plural and preserves acronyms', () => {
    expect(exercisePlural(ex('Little Baby Crunch', 'LBCs'))).toBe('LBCs')
    expect(exercisePlural(ex('LBC Hold'))).toBe('LBC holds')
  })
})

// ─── formatDuration ───────────────────────────────────────────────────────────

describe('formatDuration', () => {
  it('formats seconds, whole minutes, and mixed', () => {
    expect(formatDuration(45)).toBe('45s')
    expect(formatDuration(180)).toBe('3 min')
    expect(formatDuration(90)).toBe('1 min 30s')
  })
})

// ─── getRemainingExercises ────────────────────────────────────────────────────

describe('getRemainingExercises', () => {
  it('returns every exercise when nothing is logged', () => {
    const remaining = getRemainingExercises(JUL_TARGET, null)
    expect(remaining).toHaveLength(8)
    expect(remaining.every(r => r.remaining === r.target)).toBe(true)
  })

  it('subtracts logged reps and drops finished exercises', () => {
    const remaining = getRemainingExercises(JUL_TARGET, [
      ...allDoneExcept('incline-merkin', 'decline-merkin'),
      ...logs({ 'incline-merkin': 12 }),
    ])
    expect(remaining.map(r => r.exercise.id)).toEqual(['incline-merkin', 'decline-merkin'])
    expect(remaining[0].remaining).toBe(8)
    expect(remaining[1].remaining).toBe(20)
  })

  it('never returns negative remainders', () => {
    const remaining = getRemainingExercises(JUL_TARGET, [
      ...allDoneExcept('lunge'),
      ...logs({ lunge: 999 }),
    ])
    expect(remaining).toHaveLength(0)
  })
})

// ─── remainingLabel / formatRemainingWork ─────────────────────────────────────

describe('formatRemainingWork', () => {
  it('labels partially done timed exercises by remaining duration, untouched ones by name', () => {
    const partial = getRemainingExercises(JUL_TARGET, [
      ...allDoneExcept('dead-hang'),
      ...logs({ 'dead-hang': 120 }),
    ])
    expect(remainingLabel(partial[0])).toBe('1 min of dead hang')
    expect(formatRemainingWork(partial, 8)).toBe('1 min of dead hang')

    const untouched = getRemainingExercises(JUL_TARGET, allDoneExcept('dead-hang'))
    expect(formatRemainingWork(untouched, 8)).toBe('the dead hang')
  })

  it('lists untouched exercises by name only — no rep counts', () => {
    const two = getRemainingExercises(JUL_TARGET, allDoneExcept('incline-merkin', 'decline-merkin'))
    expect(formatRemainingWork(two, 8)).toBe('incline merkins and decline merkins')

    const three = getRemainingExercises(JUL_TARGET, allDoneExcept('incline-merkin', 'lbc', 'lunge'))
    expect(formatRemainingWork(three, 8)).toBe('incline merkins, LBCs, and lunges')
  })

  it('leads with the small remaining count for partially done exercises', () => {
    const remaining = getRemainingExercises(JUL_TARGET, [
      ...allDoneExcept('incline-merkin', 'decline-merkin'),
      ...logs({ 'incline-merkin': 12 }),
    ])
    expect(formatRemainingWork(remaining, 8)).toBe('8 incline merkins and decline merkins')
  })

  it('frames a fresh day as an exercise count, not a rep total', () => {
    const all = getRemainingExercises(JUL_TARGET, null)
    expect(formatRemainingWork(all, 8)).toBe('8 exercises')
  })

  it('falls back to an exercise count when >3 remain mid-day', () => {
    const remaining = getRemainingExercises(JUL_TARGET, [
      ...allDoneExcept('std-merkin', 'wide-merkin', 'incline-merkin', 'decline-merkin', 'lunge'),
      ...logs({ lunge: 10 }),
    ])
    expect(formatRemainingWork(remaining, 8)).toBe('5 of 8 exercises')
  })

  it('returns empty string when nothing remains', () => {
    expect(formatRemainingWork([], 8)).toBe('')
  })

  it('lists the single exercise of an escalating challenge on a fresh day', () => {
    const feb = getChallengeById('feb-2026')!
    const target = getDailyTarget(feb, '2026-02-15')!
    const remaining = getRemainingExercises(target, null)
    expect(formatRemainingWork(remaining, 1)).toBe('150 merkins')
  })
})

// ─── getRemainingNudge ────────────────────────────────────────────────────────

describe('getRemainingNudge', () => {
  it('uses the exercise custom encouragements when one exercise remains', () => {
    const remaining = getRemainingExercises(JUL_TARGET, allDoneExcept('dead-hang'))
    const pool = remaining[0].exercise.encouragements!.map(t =>
      t.replace(/\{remaining\}/g, '3 min').replace(/\{name\}/g, 'dead hangs'))
    for (let seed = 0; seed < 5; seed++) {
      expect(pool).toContain(getRemainingNudge(remaining, seed)!)
    }
  })

  it('substitutes {remaining} with the rep count for rep exercises', () => {
    const remaining = getRemainingExercises(JUL_TARGET, [
      ...allDoneExcept('lbc'),
      ...logs({ lbc: 60 }),
    ])
    const nudge = getRemainingNudge(remaining, 0)!
    expect(nudge).toContain('40')
  })

  it('falls back to a generic line when the exercise has no custom copy', () => {
    const feb = getChallengeById('feb-2026')!
    const target = getDailyTarget(feb, '2026-02-10')!
    const nudge = getRemainingNudge(getRemainingExercises(target, null), 0)
    expect(nudge).toContain('100 merkins')
  })

  it('names all exercises when two or three remain', () => {
    const remaining = getRemainingExercises(JUL_TARGET, allDoneExcept('incline-merkin', 'decline-merkin'))
    const nudge = getRemainingNudge(remaining, 1)!
    expect(nudge).toMatch(/incline merkins/)
    expect(nudge).toMatch(/decline merkins/)
  })

  it('suggests a starter exercise on a fresh day with a long list', () => {
    const fresh = getRemainingExercises(JUL_TARGET, null)
    for (let seed = 0; seed < 3; seed++) {
      const nudge = getRemainingNudge(fresh, seed)!
      expect(nudge).toMatch(/exercises/)
      expect(nudge).toMatch(/[Ss]tart|[Kk]nock out/)
      expect(nudge).not.toMatch(/\d{3}/) // never leads with a big rep total
    }
  })

  it('returns null when nothing remains or >3 exercises are open mid-day', () => {
    expect(getRemainingNudge([], 0)).toBeNull()
    const midDay = getRemainingExercises(JUL_TARGET, logs({ 'std-merkin': 8 }))
    expect(getRemainingNudge(midDay, 0)).toBeNull()
  })
})
