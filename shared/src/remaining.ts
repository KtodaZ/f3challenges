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

/**
 * Noun phrase for one remaining exercise. Untouched exercises read as plain
 * names ("incline merkins", "the dead hang") — leading with numbers makes the
 * work feel bigger than it is. Partially done ones lead with the small number
 * left ("8 incline merkins", "1 min of dead hang") because that's motivating.
 */
export function remainingLabel(r: RemainingExercise): string {
  const untouched = r.remaining >= r.target
  if ((r.exercise.unit ?? 'reps') === 'seconds') {
    const base = baseName(r.exercise)
    return untouched ? `the ${base}` : `${formatDuration(r.remaining)} of ${base}`
  }
  return untouched ? exercisePlural(r.exercise) : `${r.remaining} ${exercisePlural(r.exercise)}`
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
 * "Only X left" / "X to go" positions. Leads with exercise counts and names,
 * never rep totals ("250 reps" is demoralizing; "8 exercises" is a list you
 * can chip away at).
 *   - ≤3 exercises left:  "incline merkins and decline merkins"
 *   - >3 left, none started:  "8 exercises"
 *   - >3 left, partially done:  "5 of 8 exercises"
 *   - single-exercise challenge, fresh day:  "150 merkins" (the count IS the day)
 * Returns '' when nothing remains.
 */
export function formatRemainingWork(remaining: RemainingExercise[], totalExercises: number): string {
  if (remaining.length === 0) return ''
  if (remaining.length === 1 && totalExercises === 1) {
    const r = remaining[0]
    return (r.exercise.unit ?? 'reps') === 'seconds'
      ? `${formatDuration(r.remaining)} of ${baseName(r.exercise)}`
      : `${r.remaining} ${exercisePlural(r.exercise)}`
  }
  if (remaining.length <= 3) return joinList(remaining.map(remainingLabel))

  const notStarted =
    remaining.length === totalExercises && remaining.every(r => r.remaining === r.target)
  return notStarted
    ? `${remaining.length} exercises`
    : `${remaining.length} of ${totalExercises} exercises`
}

/**
 * A complete encouragement sentence for what's left — the "finish those dead
 * hangs" message. Uses the exercise's custom `encouragements` when a single
 * exercise remains (templates support {remaining} and {name}); otherwise falls
 * back to generic lines. On a fresh day with a long list it suggests a starter
 * exercise instead. Returns null only when nothing remains, or when more than
 * three exercises are open mid-day (generic day copy reads better there).
 */
export function getRemainingNudge(remaining: RemainingExercise[], seed: number): string | null {
  if (remaining.length === 0) return null

  if (remaining.length > 3) {
    const fresh = remaining.every(r => r.remaining === r.target)
    if (!fresh) return null
    // Fresh day: don't recite the list — frame it as N checkboxes and hand
    // the user an easy first move.
    const starter = pickSeeded(remaining, seed + 7)
    const starterName = (starter.exercise.unit ?? 'reps') === 'seconds'
      ? `the ${baseName(starter.exercise)}`
      : `the ${exercisePlural(starter.exercise)}`
    return pickSeeded([
      `Just ${remaining.length} exercises today, one at a time. Start with ${starterName} — momentum does the rest.`,
      `${remaining.length} exercises on the list. Knock out ${starterName} first and you're rolling.`,
      `Don't count reps — count exercises. ${remaining.length} to check off, starting with ${starterName}.`,
    ], seed)
  }

  if (remaining.length === 1) {
    const r = remaining[0]
    const isTimed = (r.exercise.unit ?? 'reps') === 'seconds'
    const amount = isTimed ? formatDuration(r.remaining) : String(r.remaining)
    if (r.exercise.encouragements?.length) {
      return pickSeeded(r.exercise.encouragements, seed)
        .replace(/\{remaining\}/g, amount)
        .replace(/\{name\}/g, exercisePlural(r.exercise))
    }
    const plural = exercisePlural(r.exercise)
    const amountLabel = isTimed ? `${amount} of ${baseName(r.exercise)}` : `${amount} ${plural}`
    return pickSeeded([
      `One exercise left: ${amountLabel}. Finish it off.`,
      `Just the ${plural} to go — ${amount} and you're done for the day.`,
      `Only ${amountLabel} between you and a green check. Knock it out.`,
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
