'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { MakeupDayPicker } from './MakeupDayPicker'
import { WeekCatchUpCard } from './WeekCatchUpCard'
import type { ChallengeTemplate, DailyLog, WeekProgress } from '@/types'

/** Collapsed-by-default chrome shared by both catch-up modes, so an old
 *  challenge stays out of the way until someone goes looking for it. */
function PastChallengeShell({
  challenge,
  summary,
  onDismiss,
  children,
}: {
  challenge: ChallengeTemplate
  /** Right-hand count on the header — "3 missed", "2 weeks short". */
  summary: string
  onDismiss: () => void
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <div className="flex items-center">
        <button
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="flex-1 flex items-center gap-2 px-4 py-3 text-left hover:bg-zinc-800/40 transition-colors"
        >
          <svg
            className={cn('w-4 h-4 text-zinc-500 transition-transform shrink-0', open && 'rotate-90')}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm font-semibold text-zinc-300 truncate">{challenge.name}</span>
          <span className="text-xs text-zinc-500 shrink-0">{summary}</span>
        </button>
        <button
          onClick={onDismiss}
          className="px-3 py-3 text-zinc-600 hover:text-zinc-400 transition-colors text-xs shrink-0"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>

      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  )
}

interface PastChallengeMakeupProps {
  challenge: ChallengeTemplate
  incompleteDates: string[]
  logs: Record<string, DailyLog>
  onSave: (
    date: string,
    exerciseReps: Record<string, number>,
    notes: string,
    modificationNote: string,
    isMakeUp: boolean
  ) => Promise<void>
  onDismiss: () => void
}

/** A past (ended) challenge's missed days — collapsed by default so old
 *  challenges stay out of the way. Uses the full make-up modal (notes, etc.),
 *  unlike the current challenge's swipe-to-quick-tap flow. */
export function PastChallengeMakeup({
  challenge,
  incompleteDates,
  logs,
  onSave,
  onDismiss,
}: PastChallengeMakeupProps) {
  if (incompleteDates.length === 0) return null

  return (
    <PastChallengeShell
      challenge={challenge}
      summary={`${incompleteDates.length} missed`}
      onDismiss={onDismiss}
    >
      <MakeupDayPicker
        challenge={challenge}
        incompleteDates={incompleteDates}
        logs={logs}
        onSave={onSave}
      />
    </PastChallengeShell>
  )
}

interface PastWeekCatchUpProps {
  challenge: ChallengeTemplate
  /** Weeks of this ended challenge that closed short. */
  weeks: WeekProgress[]
  onAdd: (weekEndDate: string, exerciseId: string, reps: number) => Promise<void>
  savingWeek?: string | null
  onDismiss: () => void
}

/**
 * The same idea for an ended weekly-cumulative challenge. Nothing is ever owed
 * for a specific day there, so there are no missed days to pick from — a week
 * is what falls short, and topping one up still climbs the trophy ladder.
 */
export function PastWeekCatchUp({
  challenge,
  weeks,
  onAdd,
  savingWeek,
  onDismiss,
}: PastWeekCatchUpProps) {
  if (weeks.length === 0) return null

  return (
    <PastChallengeShell
      challenge={challenge}
      summary={`${weeks.length} week${weeks.length === 1 ? '' : 's'} short`}
      onDismiss={onDismiss}
    >
      <WeekCatchUpCard
        weeks={weeks}
        exercises={challenge.exercises}
        onAdd={onAdd}
        savingWeek={savingWeek}
      />
    </PastChallengeShell>
  )
}
