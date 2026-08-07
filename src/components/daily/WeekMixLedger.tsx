'use client'

import { cn } from '@/lib/utils'
import { setsByExerciseWeight, setsVolume } from '@/lib/challenges'
import type { Exercise, LoggedSet } from '@/types'

/**
 * What this week's reps were actually made of. This is what the per-exercise
 * cards become on a weekly-cumulative challenge: a picture of your mix, not a
 * set of boxes to check — there's no per-variation target to hit.
 *
 * One row per variation *and* weight, so switching dumbbells mid-week reads as
 * two Dumbbell rows. This replaced a second "by weight" table underneath: two
 * cuts of the same reps, stacked, that almost lined up — close enough to invite
 * mapping one to the other, which was never a mapping that existed. One table
 * whose rows sum to the header can't do that.
 *
 * The cost, accepted: bars compare rows, not variations, so a variation split
 * across two weights shows two shorter bars than its true total.
 */

interface WeekMixLedgerProps {
  exercises: Exercise[]
  /** Reps this week, per exercise id. */
  repsByExercise: Record<string, number>
  /** Every set this week, for the weight breakdown. Omit to show reps only. */
  sets?: LoggedSet[]
}

export function WeekMixLedger({ exercises, repsByExercise, sets = [] }: WeekMixLedgerProps) {
  // Sets are the finer cut and cover legacy logs via `logSets`. The reps map is
  // the fallback for a caller that has no sets to give — same rows, no weights.
  const rows = sets.length > 0
    ? setsByExerciseWeight(sets, exercises)
    : exercises
        .map(ex => ({ exerciseId: ex.id, badge: null, reps: repsByExercise[ex.id] ?? 0 }))
        .filter(r => r.reps > 0)
        .sort((a, b) => b.reps - a.reps)

  const volume = setsVolume(sets)

  if (rows.length === 0) return null

  const max = Math.max(...rows.map(r => r.reps))
  const total = rows.reduce((s, r) => s + r.reps, 0)
  const nameOf = (id: string) => exercises.find(e => e.id === id)?.shortName ?? id

  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">This week&apos;s mix</p>
        <p className="text-xs text-zinc-500 tabular-nums">{total.toLocaleString()} reps</p>
      </div>
      {/* The variation name repeats on a split row rather than blanking out —
          a bare continuation mark is one more thing to decode mid-workout. */}
      {rows.map(({ exerciseId, badge, reps }) => (
        <div key={`${exerciseId}:${badge ?? ''}`} className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 w-16 shrink-0 truncate">{nameOf(exerciseId)}</span>
          <span
            className={cn(
              'text-xs font-semibold tabular-nums w-11 shrink-0',
              badge === 'BW' ? 'text-zinc-600' : 'text-amber-300/80',
            )}
          >
            {badge}
          </span>
          <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full bg-orange-500/70 transition-all duration-500')}
              style={{ width: `${Math.max(3, Math.round((reps / max) * 100))}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-zinc-300 tabular-nums w-10 text-right shrink-0">
            {reps}
          </span>
        </div>
      ))}

      {volume > 0 && (
        <p className="text-xs text-amber-300/80 tabular-nums font-semibold text-right pt-1">
          {volume.toLocaleString()} lb moved
        </p>
      )}
    </div>
  )
}
