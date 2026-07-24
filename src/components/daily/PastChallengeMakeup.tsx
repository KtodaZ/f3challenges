'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { MakeupDayPicker } from './MakeupDayPicker'
import type { ChallengeTemplate, DailyLog } from '@/types'

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
  const [open, setOpen] = useState(false)

  if (incompleteDates.length === 0) return null

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
          <span className="text-xs text-zinc-500 shrink-0">
            {incompleteDates.length} missed
          </span>
        </button>
        <button
          onClick={onDismiss}
          className="px-3 py-3 text-zinc-600 hover:text-zinc-400 transition-colors text-xs shrink-0"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>

      {open && (
        <div className="px-4 pb-4 pt-1">
          <MakeupDayPicker
            challenge={challenge}
            incompleteDates={incompleteDates}
            logs={logs}
            onSave={onSave}
          />
        </div>
      )}
    </div>
  )
}
