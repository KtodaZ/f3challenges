'use client'

import { cn, formatClock } from '@/lib/utils'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { getRemainingExercises } from '@/lib/challenges'
import type { DailyLog, DailyTarget, ExerciseUnit } from '@/types'

/** Amount in the exercise's own unit — clock for timed, plain count for reps. */
function amount(value: number, unit?: ExerciseUnit): string {
  return (unit ?? 'reps') === 'seconds' ? formatClock(value) : String(value)
}

function CompletionRing({ fraction }: { fraction: number }) {
  const size = 48
  const strokeWidth = 5
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.min(1, Math.max(0, fraction)))
  const isDone = fraction >= 1

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#27272a" strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={isDone ? '#22c55e' : '#f97316'}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn('text-[11px] font-bold', isDone ? 'text-green-400' : 'text-orange-400')}>
          {Math.round(fraction * 100)}%
        </span>
      </div>
    </div>
  )
}

interface TodaySummaryProps {
  target: DailyTarget
  log: DailyLog | null
}

/**
 * Condensed "Today" card for a profile — at a glance, what this PAX has
 * knocked out today and what's still on the board. Read-only; the home page
 * is where logging happens.
 */
export function TodaySummary({ target, log }: TodaySummaryProps) {
  const fraction = log?.completionFraction ?? 0
  const isDone = fraction >= 1

  // ── Rest day: nothing to report ──
  if (target.isRestDay) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Today</CardTitle>
          <span className="text-xs text-zinc-500 font-normal">Day {target.day}</span>
        </CardHeader>
        <div className="flex items-center gap-3">
          <span className="text-2xl shrink-0">🏖️</span>
          <p className="text-sm text-zinc-400">Rest day — no workout required.</p>
        </div>
      </Card>
    )
  }

  // Exercises with any reps logged today, in the day's exercise order.
  const done = target.exercises
    .map(({ exercise, reps }) => {
      const completed = log?.exerciseLogs.find(el => el.exerciseId === exercise.id)?.completedReps ?? 0
      return completed > 0 ? { exercise, completed, target: reps } : null
    })
    .filter((d): d is NonNullable<typeof d> => d !== null)

  const remaining = getRemainingExercises(target, log?.exerciseLogs)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today</CardTitle>
        <span className="text-xs text-zinc-500 font-normal">Day {target.day}</span>
      </CardHeader>

      <div className="flex items-start gap-4">
        <CompletionRing fraction={fraction} />

        <div className="flex-1 min-w-0 space-y-3">
          {/* ── Done today ── */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-green-500/80 mb-1">
              ✓ Done
            </p>
            {done.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {done.map(({ exercise, completed, target: tgt }) => {
                  const full = completed >= tgt
                  return (
                    <span
                      key={exercise.id}
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border',
                        full
                          ? 'bg-green-900/30 border-green-700/40 text-green-300'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                      )}
                    >
                      {amount(completed, exercise.unit)}
                      {!full && <span className="text-zinc-500">/{amount(tgt, exercise.unit)}</span>}
                      {' '}{exercise.shortName}
                    </span>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">Nothing logged yet.</p>
            )}
          </div>

          {/* ── Still to do ── */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-500/80 mb-1">
              ◔ To do
            </p>
            {remaining.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {remaining.map(({ exercise, remaining: left }) => (
                  <span
                    key={exercise.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-orange-900/20 border-orange-800/40 text-orange-300"
                  >
                    {amount(left, exercise.unit)} {exercise.shortName}
                  </span>
                ))}
              </div>
            ) : (
              <p className={cn('text-xs', isDone ? 'text-green-400 font-medium' : 'text-zinc-500')}>
                {isDone ? 'All done today! 🎉' : 'Nothing left today.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
