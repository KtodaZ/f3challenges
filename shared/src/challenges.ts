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
    dailyMultiplier: 5,
    startDate: '2026-03-01',
    endDate: '2026-03-31',
    exercises: [
      { id: 'lbc', name: 'Little Baby Crunch', shortName: 'LBC' },
    ],
  },
  {
    id: 'apr-2026',
    name: 'The Merking Gauntlet',
    hashtag: '#TheMerkingGauntlet',
    tagline: 'ONE MONTH. NO EXCUSES. CONQUER EM ALL',
    month: 4,
    year: 2026,
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

/** Computes the daily target for a given challenge and date. */
export function getDailyTarget(challenge: ChallengeTemplate, date: string): DailyTarget | null {
  const day = getDayNumber(challenge, date)
  if (day === null) return null

  const totalReps = day * challenge.dailyMultiplier
  const repsPerExercise = totalReps / challenge.exercises.length

  return {
    date,
    day,
    totalReps,
    repsPerExercise,
    exercises: challenge.exercises.map(ex => ({ exercise: ex, reps: repsPerExercise })),
  }
}

/** Returns total reps for the full challenge month. */
export function getMonthlyTotal(challenge: ChallengeTemplate): number {
  const days = getTotalDays(challenge)
  let total = 0
  for (let d = 1; d <= days; d++) {
    total += d * challenge.dailyMultiplier
  }
  return total
}

/** Total days in the challenge. */
export function getTotalDays(challenge: ChallengeTemplate): number {
  const start = new Date(challenge.startDate + 'T00:00:00')
  const end   = new Date(challenge.endDate + 'T00:00:00')
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
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
