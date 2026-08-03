'use client'

import { cn } from '@/lib/utils'
import { allSets, setsByWeight, setsVolume, formatLoad, badgeLoad } from '@/lib/challenges'
import type { ChallengeTemplate, DailyLog } from '@/types'

/**
 * What a PAX's reps were actually made of, for one challenge: which variations
 * they favour, and what they moved them with.
 *
 * The leaderboard shows one number and one badge; this is the story behind
 * both. It reads the same sets the pad writes, so a day logged as 2×20
 * dumbbells and 1×40 coupon shows up as exactly that rather than being
 * flattened into whichever weight came last.
 */

interface RepBreakdownProps {
  challenge: ChallengeTemplate
  /** This PAX's logs for the challenge. */
  logs: DailyLog[]
}

export function RepBreakdown({ challenge, logs }: RepBreakdownProps) {
  const sets = allSets(logs)
  const totalReps = sets.reduce((sum, s) => sum + s.reps, 0)

  if (totalReps === 0) {
    return <p className="text-sm text-zinc-500">No reps logged yet this challenge.</p>
  }

  const byExercise = challenge.exercises
    .map(ex => ({
      ex,
      reps: sets.filter(s => s.exerciseId === ex.id).reduce((sum, s) => sum + s.reps, 0),
    }))
    .filter(r => r.reps > 0)
    .sort((a, b) => b.reps - a.reps)

  const byWeight = setsByWeight(sets)
  const volume = setsVolume(sets)
  const usual = formatLoad(badgeLoad(sets))
  const maxReps = byExercise[0]?.reps ?? 1
  // The weight bars get their own scale — sharing the variation scale would
  // measure them against a number from a different question.
  const maxWeightReps = Math.max(...byWeight.map(w => w.reps), 1)
  const weighted = byWeight.reduce((s, w) => s + w.reps, 0)

  // The single best day, so the number has a face: "412 on Aug 12".
  const best = logs.reduce<{ date: string; reps: number } | null>((top, log) => {
    const reps = log.exerciseLogs.reduce((s, e) => s + e.completedReps, 0)
    return !top || reps > top.reps ? { date: log.date, reps } : top
  }, null)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Reps" value={totalReps.toLocaleString()} />
        <Stat label="Usually at" value={usual ?? '—'} accent={!!usual} />
        <Stat
          label="Pounds moved"
          value={volume > 0 ? volume.toLocaleString() : '—'}
          accent={volume > 0}
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">By variation</p>
        {byExercise.map(({ ex, reps }) => (
          <div key={ex.id} className="flex items-center gap-3">
            <span className="text-xs text-zinc-400 w-16 shrink-0 truncate">{ex.shortName}</span>
            <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-orange-500/70 transition-all duration-500"
                style={{ width: `${Math.max(3, Math.round((reps / maxReps) * 100))}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-zinc-300 tabular-nums w-12 text-right shrink-0">
              {reps.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      {byWeight.length > 0 && (
        <div className="space-y-2">
          {/* Heaviest first — the order is the point, so it needs no label. */}
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">By weight</p>
          {byWeight.map(({ badge, reps, volume: moved }) => (
            <div key={badge} className="flex items-center gap-3">
              <span className="text-xs font-semibold text-amber-300/90 tabular-nums w-12 shrink-0">
                {badge}
              </span>
              <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500/60 transition-all duration-500"
                  style={{ width: `${Math.max(3, Math.round((reps / maxWeightReps) * 100))}%` }}
                />
              </div>
              <span className="text-xs text-zinc-500 tabular-nums w-20 text-right shrink-0">
                {reps.toLocaleString()}
                <span className="text-zinc-600"> · {moved.toLocaleString()} lb</span>
              </span>
            </div>
          ))}
          {/* Bodyweight work has no weight to group under, but leaving it
              unmentioned makes the reps look like they went missing. */}
          {weighted < totalReps && (
            <p className="text-xs text-zinc-600">
              {(totalReps - weighted).toLocaleString()} reps logged without a weight
            </p>
          )}
        </div>
      )}

      {best && best.reps > 0 && (
        <p className="text-xs text-zinc-500">
          Best day <span className="text-zinc-300 font-semibold tabular-nums">{best.reps.toLocaleString()}</span>
          {' on '}
          {new Date(best.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
      )}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-3 py-2.5">
      <p className={cn('text-lg font-bold tabular-nums', accent ? 'text-amber-300' : 'text-white')}>
        {value}
      </p>
      <p className="text-[11px] text-zinc-500 font-medium leading-tight mt-0.5">{label}</p>
    </div>
  )
}
