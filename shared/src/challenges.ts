// ─── Challenge Definitions ────────────────────────────────────────────────────
// Single source of truth for all challenges.
//
// To add a new challenge:
//   1. Append one object to CHALLENGES below.
//   2. That's it — no other changes needed anywhere.
//
// This file is shared between the Next.js app and Cloud Functions via the
// @f3-bedrock/shared workspace package. Both consume it at build time
// (Next.js transpiles it; esbuild bundles it into functions/lib/index.js).

import type { ChallengeTemplate, DailyTarget } from './types'

export const CHALLENGES: ChallengeTemplate[] = [
  {
    id: 'feb-2026',
    name: 'Merkin Challenge',
    hashtag: '#MerkinChallenge',
    tagline: 'The original. The foundation.',
    month: 2,
    year: 2026,
    type: 'escalating',
    dailyMultiplier: 10,
    startDate: '2026-02-01',
    endDate: '2026-02-28',
    exercises: [
      { id: 'merkin', name: 'Merkin', shortName: 'Merkin' },
    ],
  },
  {
    id: 'mar-2026',
    name: 'LBC Challenge',
    hashtag: '#LBCChallenge',
    tagline: 'Core strong. Every day.',
    month: 3,
    year: 2026,
    type: 'escalating',
    dailyMultiplier: 5,
    startDate: '2026-03-01',
    endDate: '2026-03-31',
    exercises: [
      { id: 'lbc', name: 'Little Baby Crunch', shortName: 'LBC' },
    ],
  },
  {
    id: 'apr-2026',
    name: 'The Merkin Gauntlet',
    hashtag: '#TheMerkinGauntlet',
    tagline: 'ONE MONTH. NO EXCUSES. CONQUER EM ALL',
    month: 4,
    year: 2026,
    type: 'escalating',
    dailyMultiplier: 10,
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    exercises: [
      { id: 'merkin',          name: 'Merkin',          shortName: 'Merkin'   },
      { id: 'diamond-merkin',  name: 'Diamond Merkin',  shortName: 'Diamond'  },
      { id: 'wide-merkin',     name: 'Wide Arm Merkin', shortName: 'Wide Arm' },
      { id: 'incline-merkin',  name: 'Incline Merkin',  shortName: 'Incline'  },
      { id: 'decline-merkin',  name: 'Decline Merkin',  shortName: 'Decline'  },
    ],
  },
  {
    id: 'may-2026',
    name: 'Death by Basics',
    hashtag: '#MayChallengeDrop',
    tagline: 'Back to fundamentals. Every. Single. Day.',
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
          { exerciseId: 'pullup',    amount: 10 },
          { exerciseId: 'pushup',    amount: 20 },
          { exerciseId: 'air-squat', amount: 30 },
          { exerciseId: 'dead-hang', amount: 30 },
        ],
      },
      {
        startDay: 9, endDay: 16,
        targets: [
          { exerciseId: 'pullup',    amount: 20 },
          { exerciseId: 'pushup',    amount: 30 },
          { exerciseId: 'air-squat', amount: 40 },
          { exerciseId: 'dead-hang', amount: 60 },
        ],
      },
      {
        startDay: 17, endDay: 23,
        targets: [
          { exerciseId: 'pullup',    amount: 30 },
          { exerciseId: 'pushup',    amount: 40 },
          { exerciseId: 'air-squat', amount: 50 },
          { exerciseId: 'dead-hang', amount: 90 },
        ],
      },
      {
        startDay: 24, endDay: 31,
        targets: [
          { exerciseId: 'pullup',    amount: 40 },
          { exerciseId: 'pushup',    amount: 50 },
          { exerciseId: 'air-squat', amount: 60 },
          { exerciseId: 'dead-hang', amount: 120 },
        ],
      },
    ],
    // May 25: Memorial Day — no workout required
    restDates: ['2026-05-25'],
    // May 26: optional rest for those who logged a workout on Memorial Day (the Murph)
    conditionalRestDates: [
      {
        date: '2026-05-26',
        conditionLabel: 'Did you do the Murph yesterday?',
        conditionType: 'logged-previous-day',
      },
    ],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the challenge active on a given date, or undefined. */
export function getChallengeForDate(date: string): ChallengeTemplate | undefined {
  return CHALLENGES.find(c => date >= c.startDate && date <= c.endDate)
}

/** Returns today's active challenge (PT date). */
export function getCurrentChallenge(): ChallengeTemplate | undefined {
  return getChallengeForDate(getTodayPT())
}

export function getChallengeById(id: string): ChallengeTemplate | undefined {
  return CHALLENGES.find(c => c.id === id)
}

/**
 * Returns day number (1-based) for a given date within a challenge.
 * Returns null if the date is outside the challenge window.
 */
export function getDayNumber(challenge: ChallengeTemplate, date: string): number | null {
  if (date < challenge.startDate || date > challenge.endDate) return null
  const start = new Date(challenge.startDate + 'T00:00:00')
  const d     = new Date(date + 'T00:00:00')
  const diff  = Math.round((d.getTime() - start.getTime()) / 86_400_000)
  return diff + 1
}

/** Returns true if the given date is a fixed rest day (no log required for anyone). */
export function isRestDay(challenge: ChallengeTemplate, date: string): boolean {
  return challenge.restDates?.includes(date) ?? false
}

/**
 * Returns true if a conditional rest day applies to a specific user.
 * Pass the dates the user has completed (completionFraction >= 1).
 */
export function conditionalRestApplies(
  challenge: ChallengeTemplate,
  date: string,
  completedLogDates: string[],
): boolean {
  const cr = challenge.conditionalRestDates?.find(r => r.date === date)
  if (!cr) return false
  if (cr.conditionType === 'logged-previous-day') {
    const d = new Date(date + 'T00:00:00')
    d.setDate(d.getDate() - 1)
    const prev = d.toLocaleDateString('en-CA')
    return completedLogDates.includes(prev)
  }
  return false
}

/** Computes the daily target for a given challenge and date. */
export function getDailyTarget(challenge: ChallengeTemplate, date: string): DailyTarget | null {
  const day = getDayNumber(challenge, date)
  if (day === null) return null

  // Fixed rest days: return a rest-day marker with no exercises
  if (challenge.restDates?.includes(date)) {
    return { date, day, isRestDay: true, totalReps: 0, repsPerExercise: 0, exercises: [] }
  }

  // Conditional rest day: normal target but flagged so the UI can show the option
  const conditionalRest = challenge.conditionalRestDates?.find(r => r.date === date)

  const challengeType = challenge.type ?? 'escalating'

  if (challengeType === 'weekly-tiers') {
    const tier = challenge.weeklyTiers?.find(t => day >= t.startDay && day <= t.endDay)
    if (!tier) return null

    const exercises = challenge.exercises.map(ex => {
      const t = tier.targets.find(t => t.exerciseId === ex.id)
      return { exercise: ex, reps: t?.amount ?? 0 }
    })

    // totalReps counts rep-type exercises only (not timed)
    const totalReps = exercises.reduce((sum, e) => {
      return (e.exercise.unit ?? 'reps') === 'reps' ? sum + e.reps : sum
    }, 0)

    const firstRepTarget = exercises.find(e => (e.exercise.unit ?? 'reps') === 'reps')?.reps ?? 0

    return {
      date,
      day,
      isRestDay: false,
      ...(conditionalRest ? { isConditionalRestDay: true, conditionalRestLabel: conditionalRest.conditionLabel } : {}),
      totalReps,
      repsPerExercise: firstRepTarget,
      exercises,
    }
  }

  // 'escalating' (default)
  const totalReps = day * (challenge.dailyMultiplier ?? 0)
  const repsPerExercise = challenge.exercises.length > 0 ? totalReps / challenge.exercises.length : totalReps

  return {
    date,
    day,
    isRestDay: false,
    ...(conditionalRest ? { isConditionalRestDay: true, conditionalRestLabel: conditionalRest.conditionLabel } : {}),
    totalReps,
    repsPerExercise,
    exercises: challenge.exercises.map(ex => ({ exercise: ex, reps: repsPerExercise })),
  }
}

/** Total calendar days in the challenge. */
export function getTotalDays(challenge: ChallengeTemplate): number {
  const start = new Date(challenge.startDate + 'T00:00:00')
  const end   = new Date(challenge.endDate + 'T00:00:00')
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
}

/**
 * Days that require a log — excludes only fixed rest days.
 * Conditional rest days are per-user and not subtracted here; callers handle
 * those based on whether the condition was met for that specific user.
 */
export function getRequiredDays(challenge: ChallengeTemplate): number {
  return getTotalDays(challenge) - (challenge.restDates?.length ?? 0)
}

/** Returns total reps for the full challenge month (rep-type exercises only, rest days excluded). */
export function getMonthlyTotal(challenge: ChallengeTemplate): number {
  return getChallengeDates(challenge).reduce((total, date) => {
    const target = getDailyTarget(challenge, date)
    return target && !target.isRestDay ? total + target.totalReps : total
  }, 0)
}

/** Returns today's date as YYYY-MM-DD in PT timezone. */
export function getTodayPT(): string {
  return new Date()
    .toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
}

/** Returns reps completed as a fraction of today's target. */
export function repsFractionLabel(fraction: number): string {
  if (fraction >= 1)    return 'Done ✓'
  if (fraction >= 0.75) return '3/4 Done'
  if (fraction >= 0.5)  return 'Halfway'
  if (fraction >= 0.25) return '1/4 Done'
  return 'Not started'
}

/** All dates in a challenge as YYYY-MM-DD strings. */
export function getChallengeDates(challenge: ChallengeTemplate): string[] {
  const dates: string[] = []
  // Use noon UTC so date string extraction is unambiguous in any runtime timezone.
  const current = new Date(challenge.startDate + 'T12:00:00Z')
  const end     = new Date(challenge.endDate + 'T12:00:00Z')
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10))
    current.setUTCDate(current.getUTCDate() + 1)
  }
  return dates
}
