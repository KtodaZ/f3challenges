'use client'

import { cn } from '@/lib/utils'
import { setsByWeight, setsVolume } from '@/lib/challenges'
import type { Exercise, LoggedSet } from '@/types'

/**
 * What this week's reps were actually made of. This is what the per-exercise
 * cards become on a weekly-cumulative challenge: a picture of your mix, not a
 * set of boxes to check — there's no per-variation target to hit.
 *
 * With sets carrying their own weight there's a second cut worth showing: the
 * same 300 reps split across 2×20 and 1×40 is a different week than 300 at
 * bodyweight, and the pounds moved says so.
 */

interface WeekMixLedgerProps {
  exercises: Exercise[]
  /** Reps this week, per exercise id. */
  repsByExercise: Record<string, number>
  /** Every set this week, for the weight breakdown. Omit to show reps only. */
  sets?: LoggedSet[]
}

export function WeekMixLedger({ exercises, repsByExercise, sets = [] }: WeekMixLedgerProps) {
  const rows = exercises
    .map(ex => ({ ex, reps: repsByExercise[ex.id] ?? 0 }))
    .filter(r => r.reps > 0)
    .sort((a, b) => b.reps - a.reps)

  const byWeight = setsByWeight(sets)
  const volume = setsVolume(sets)

  if (rows.length === 0) return null

  const max = rows[0].reps
  const total = rows.reduce((s, r) => s + r.reps, 0)

  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">This week&apos;s mix</p>
        <p className="text-xs text-zinc-500 tabular-nums">{total.toLocaleString()} reps</p>
      </div>
      {rows.map(({ ex, reps }) => (
        <div key={ex.id} className="flex items-center gap-3">
          <span className="text-xs text-zinc-400 w-16 shrink-0 truncate">{ex.shortName}</span>
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

      {byWeight.length > 0 && (
        <div className="pt-2.5 mt-0.5 border-t border-zinc-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">By weight</p>
            {volume > 0 && (
              <p className="text-xs text-amber-300/80 tabular-nums font-semibold">
                {volume.toLocaleString()} lb moved
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {byWeight.map(({ badge, reps }) => (
              <span
                key={badge}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-800 text-xs"
              >
                <span className="font-semibold text-amber-300/90 tabular-nums">{badge}</span>
                <span className="text-zinc-500 tabular-nums">{reps}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
