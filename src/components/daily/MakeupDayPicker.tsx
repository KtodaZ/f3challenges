'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { getDailyTarget } from '@/lib/challenges'
import { LogDayModal } from './LogDayModal'
import type { ChallengeTemplate, DailyLog, CompletionFraction } from '@/types'

interface MakeupDayPickerProps {
  challenge: ChallengeTemplate
  incompleteDates: string[]           // YYYY-MM-DD strings, past only
  logs: Record<string, DailyLog>      // keyed by date
  onSave: (
    date: string,
    exerciseFractions: Record<string, CompletionFraction>,
    notes: string,
    modificationNote: string,
    isMakeUp: boolean
  ) => Promise<void>
}

export function MakeupDayPicker({
  challenge,
  incompleteDates,
  logs,
  onSave,
}: MakeupDayPickerProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  if (incompleteDates.length === 0) return null

  const selectedTarget = selectedDate
    ? getDailyTarget(challenge, selectedDate)
    : null

  function handleDateTap(date: string) {
    setSelectedDate(date)
  }

  async function handleSave(
    fractions: Record<string, CompletionFraction>,
    notes: string,
    modificationNote: string,
    isMakeUp: boolean
  ) {
    if (!selectedDate) return
    await onSave(selectedDate, fractions, notes, modificationNote, isMakeUp)
  }

  return (
    <>
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-amber-400 text-sm font-semibold">
            Missed days ({incompleteDates.length})
          </span>
          <span className="text-zinc-500 text-xs">— tap to make up</span>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {incompleteDates.map(date => {
            const log = logs[date]
            const fraction = log?.completionFraction ?? 0
            const pct = Math.round(fraction * 100)
            const hasProgress = fraction > 0

            return (
              <button
                key={date}
                onClick={() => handleDateTap(date)}
                className={cn(
                  'shrink-0 flex flex-col items-center gap-1',
                  'bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5',
                  'min-w-[72px] min-h-[64px]',
                  'hover:border-amber-500/50 hover:bg-zinc-800',
                  'active:scale-95 transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500'
                )}
              >
                <span className="text-xs text-zinc-400">
                  {new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
                    weekday: 'short',
                  })}
                </span>
                <span className="text-sm font-bold text-white">
                  {new Date(date + 'T12:00:00').getDate()}
                </span>
                {hasProgress ? (
                  <span className="text-xs text-orange-400 font-medium">{pct}%</span>
                ) : (
                  <span className="text-xs text-zinc-600">—</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {selectedTarget && (
        <LogDayModal
          open={selectedDate !== null}
          onClose={() => setSelectedDate(null)}
          target={selectedTarget}
          existingLog={selectedDate ? (logs[selectedDate] ?? null) : null}
          onSave={handleSave}
          isMakeUp
        />
      )}
    </>
  )
}
