// ─── Remaining-Work Messaging ─────────────────────────────────────────────────
// Turns "how much is left today" into exercise-aware copy:
//   "only 20 incline merkins and 20 decline merkins left"
// instead of "40 reps left". Exercises can carry custom `encouragements`
// (see challenges.ts) that surface when they're the last thing standing.
//
// Used by Cloud Function push notifications and the home-page welcome message.

import type { DailyTarget, Exercise } from './types'

export interface RemainingExercise {
  exercise: Exercise
  /** Amount still to do, in the exercise's unit (reps or seconds). */
  remaining: number
  /** Today's full target for this exercise, same unit. */
  target: number
}

function pickSeeded<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length]
}

/** "Lunge (2:1)" → "lunge"; acronym words keep their case ("LBC" stays "LBC"). */
function baseName(ex: Exercise): string {
  return ex.name
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .trim()
    .split(/\s+/)
    .map(w => (/[A-Z]{2,}/.test(w) ? w : w.toLowerCase()))
    .join(' ')
}

/** Lowercased plural display name: "incline merkins", "LBCs", "little baby crunches". */
export function exercisePlural(ex: Exercise): string {
  if (ex.plural) return ex.plural
  const name = baseName(ex)
  if (/(s|x|z|ch|sh)$/.test(name)) return name + 'es'
  if (/[^aeiou]y$/.test(name)) return name.slice(0, -1) + 'ies'
  return name + 's'
}

/** 45 → "45s", 180 → "3 min", 90 → "1 min 30s" */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds % 60 === 0) return `${seconds / 60} min`
  return `${Math.floor(seconds / 60)} min ${seconds % 60}s`
}

/** Noun phrase for one exercise's remaining amount: "20 incline merkins", "90s of dead hang". */
export function remainingLabel(r: RemainingExercise): string {
  if ((r.exercise.unit ?? 'reps') === 'seconds') {
    return `${formatDuration(r.remaining)} of ${baseName(r.exercise)}`
  }
  return `${r.remaining} ${exercisePlural(r.exercise)}`
}

/**
 * Which of today's exercises still have work left, given the user's exercise
 * logs (pass undefined/null/[] when nothing has been logged yet).
 */
export function getRemainingExercises(
  target: DailyTarget,
  exerciseLogs?: Array<{ exerciseId: string; completedReps: number }> | null,
): RemainingExercise[] {
  const logged = new Map((exerciseLogs ?? []).map(l => [l.exerciseId, l.completedReps]))
  return target.exercises
    .filter(e => e.reps > 0)
    .map(({ exercise, reps }) => ({
      exercise,
      target: reps,
      remaining: Math.max(0, reps - (logged.get(exercise.id) ?? 0)),
    }))
    .filter(r => r.remaining > 0)
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

/**
 * Noun phrase for everything still to do today — reads naturally in
 * "Only X left" / "X to go" positions.
 *   - ≤3 exercises left:  "20 incline merkins and 20 decline merkins"
 *   - >3 left, none started:  "220 reps + 3 min of dead hang"  (compact day summary)
 *   - >3 left, partially done:  "5 of 8 exercises"
 * Returns '' when nothing remains.
 */
export function formatRemainingWork(remaining: RemainingExercise[], totalExercises: number): string {
  if (remaining.length === 0) return ''
  if (remaining.length <= 3) return joinList(remaining.map(remainingLabel))

  const notStarted =
    remaining.length === totalExercises && remaining.every(r => r.remaining === r.target)
  if (notStarted) {
    const reps = remaining.reduce(
      (sum, r) => ((r.exercise.unit ?? 'reps') === 'reps' ? sum + r.remaining : sum), 0)
    const timed = remaining
      .filter(r => (r.exercise.unit ?? 'reps') === 'seconds')
      .map(remainingLabel)
    return [reps > 0 ? `${reps} reps` : '', ...timed].filter(Boolean).join(' + ')
  }
  return `${remaining.length} of ${totalExercises} exercises`
}

/**
 * A complete encouragement sentence for what's left — the "finish those dead
 * hangs" message. Uses the exercise's custom `encouragements` when a single
 * exercise remains (templates support {remaining} and {name}); otherwise falls
 * back to generic lines. Returns null when nothing remains or more than three
 * exercises are still open (generic day copy reads better there).
 */
export function getRemainingNudge(remaining: RemainingExercise[], seed: number): string | null {
  if (remaining.length === 0 || remaining.length > 3) return null

  if (remaining.length === 1) {
    const r = remaining[0]
    const amount = (r.exercise.unit ?? 'reps') === 'seconds'
      ? formatDuration(r.remaining)
      : String(r.remaining)
    if (r.exercise.encouragements?.length) {
      return pickSeeded(r.exercise.encouragements, seed)
        .replace(/\{remaining\}/g, amount)
        .replace(/\{name\}/g, exercisePlural(r.exercise))
    }
    const label = remainingLabel(r)
    return pickSeeded([
      `Just the ${exercisePlural(r.exercise)} left — ${label} and the day is yours.`,
      `One exercise left: ${label}. Finish it off.`,
      `Only ${label} between you and a green check. Knock it out.`,
    ], seed)
  }

  const list = joinList(remaining.map(remainingLabel))
  const names = joinList(remaining.map(r => exercisePlural(r.exercise)))
  return pickSeeded([
    `Only ${remaining.length} exercises left: ${list}. You're almost there.`,
    `Down to ${names}. Close it out.`,
    `Just ${list} still on the board — finish the day.`,
  ], seed)
}
