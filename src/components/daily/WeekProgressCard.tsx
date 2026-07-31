'use client'

import { cn } from '@/lib/utils'
import type { WeekProgress } from '@/types'

/**
 * The headline card for a weekly-cumulative challenge: one bar you fill over
 * the week, with the quarter/half/three-quarter rungs marked on the track.
 *
 * Deliberately not a percentage dial. A ring reads as "today's completion",
 * and on these challenges today has no target — the week does. The two numbers
 * that actually drive behavior are what's left and how many days are left to
 * do it in, so those get the space.
 */

interface WeekProgressCardProps {
  progress: WeekProgress
  /** Reps banked today, shown as the "already in" line. */
  todayReps: number
  /** Total weeks in the challenge, for the "Week 2 of 6" header. */
  totalWeeks: number
}

const RUNGS = [0.25, 0.5, 0.75]

function paceLine(p: WeekProgress, todayReps: number): string {
  if (p.isComplete) {
    const over = p.reps - p.target
    return over > 0
      ? `${over.toLocaleString()} past the line — banked for the fun of it.`
      : 'Week complete. Anything else is interest.'
  }
  if (p.daysLeft === 0) return `Week's over — ${p.remaining.toLocaleString()} short. Top it up any time.`
  if (p.daysLeft === 1) return `Last day. ${p.remaining.toLocaleString()} to go.`
  if (p.reps === 0) return `${p.perDayNeeded}/day over ${p.daysLeft} days gets it done.`
  if (todayReps > 0) return `${todayReps} in today · ~${p.perDayNeeded}/day for the rest of the week.`
  return `~${p.perDayNeeded}/day across the ${p.daysLeft} days left.`
}

export function WeekProgressCard({ progress, todayReps, totalWeeks }: WeekProgressCardProps) {
  const { week, reps, target, fraction, remaining, isComplete } = progress
  const pct = Math.round(fraction * 100)

  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-4 space-y-3',
        isComplete
          ? 'bg-green-950/40 border-green-800/60'
          : reps > 0
          ? 'bg-orange-950/30 border-orange-800/40'
          : 'bg-zinc-900 border-zinc-800'
      )}
    >
      {/* Header: which week, and the raw count */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className={cn(
            'text-xs font-semibold uppercase tracking-widest',
            isComplete ? 'text-green-400' : 'text-orange-400'
          )}>
            {week.label ?? `Week ${week.index} of ${totalWeeks}`}
          </p>
          <p className="text-zinc-500 text-xs mt-0.5">
            {formatRange(week.startDate, week.endDate)}
          </p>
        </div>
        <p className="shrink-0 tabular-nums">
          <span className={cn(
            'text-2xl font-extrabold leading-none',
            isComplete ? 'text-green-300' : 'text-white'
          )}>
            {reps.toLocaleString()}
          </span>
          <span className="text-sm font-semibold text-zinc-500"> / {target.toLocaleString()}</span>
        </p>
      </div>

      {/* The bar, with quarter rungs on the track */}
      <div className="relative h-3 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isComplete ? 'bg-green-500' : 'bg-orange-500'
          )}
          style={{ width: `${Math.max(pct, reps > 0 ? 2 : 0)}%` }}
        />
        {RUNGS.map(r => (
          <div
            key={r}
            aria-hidden="true"
            className="absolute top-0 bottom-0 w-px bg-zinc-950/70"
            style={{ left: `${r * 100}%` }}
          />
        ))}
      </div>

      {/* What's left + pace — the two numbers that change behavior */}
      <div className="flex items-baseline justify-between gap-3">
        <p className={cn('text-sm font-bold', isComplete ? 'text-green-300' : 'text-white')}>
          {isComplete
            ? '✅ Week complete'
            : `${remaining.toLocaleString()} to go`}
        </p>
        <p className="text-xs text-zinc-400 text-right min-w-0 truncate">
          {paceLine(progress, todayReps)}
        </p>
      </div>
    </div>
  )
}

/** "Sun Aug 2 – Sat Aug 8", collapsed to one date on a single-day week. */
function formatRange(start: string, end: string): string {
  const fmt = (d: string) =>
    new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
    })
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`
}
