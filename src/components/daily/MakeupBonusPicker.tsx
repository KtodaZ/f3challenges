'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn, formatDate } from '@/lib/utils'
import type { BonusChallengeWeek } from '@/types'

export interface MissedBonusWeek {
  week: BonusChallengeWeek
  number: number // 1-based week number within the bonus challenge
}

interface MakeupBonusPickerProps {
  bonusName: string
  missedWeeks: MissedBonusWeek[]
  onComplete: (week: BonusChallengeWeek) => Promise<void>
  savingWeekStart: string | null // startDate of the week currently saving, or null
}

export function MakeupBonusPicker({
  bonusName,
  missedWeeks,
  onComplete,
  savingWeekStart,
}: MakeupBonusPickerProps) {
  const [selected, setSelected] = useState<MissedBonusWeek | null>(null)

  if (missedWeeks.length === 0) return null

  async function handleConfirm() {
    if (!selected) return
    await onComplete(selected.week)
    setSelected(null)
  }

  return (
    <>
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-blue-400 text-sm font-semibold">
            Missed bonus ({missedWeeks.length})
          </span>
          <span className="text-zinc-500 text-xs">— tap to make up</span>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {missedWeeks.map(({ week, number }) => (
            <button
              key={week.startDate}
              onClick={() => setSelected({ week, number })}
              className={cn(
                'shrink-0 flex flex-col items-center justify-center gap-1',
                'bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5',
                'min-w-[84px] min-h-[64px]',
                'hover:border-blue-500/50 hover:bg-zinc-800',
                'active:scale-95 transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
              )}
            >
              <span className="text-blue-400 text-base leading-none">🔒</span>
              <span className="text-sm font-bold text-white">Week {number}</span>
              <span className="text-xs text-zinc-500">
                {new Date(week.startDate + 'T12:00:00').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <MakeupBonusModal
          bonusName={bonusName}
          missed={selected}
          saving={savingWeekStart === selected.week.startDate}
          onConfirm={handleConfirm}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}

// ─── Reveal + confirm modal ─────────────────────────────────────────────────

interface MakeupBonusModalProps {
  bonusName: string
  missed: MissedBonusWeek
  saving: boolean
  onConfirm: () => Promise<void>
  onClose: () => void
}

function MakeupBonusModal({ bonusName, missed, saving, onConfirm, onClose }: MakeupBonusModalProps) {
  const [visible, setVisible] = useState(false)
  const { week, number } = missed

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-0 bg-zinc-950/90 transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0'
        )}
        onClick={saving ? undefined : onClose}
      />

      <div
        className={cn(
          'relative z-10 text-center max-w-sm w-full transition-all duration-300 ease-out',
          visible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
        )}
        onClick={e => e.stopPropagation()}
      >
        <div className="text-6xl mb-3" role="img" aria-label="rewind">⏪</div>

        <p className="text-blue-400 text-xs font-semibold uppercase tracking-widest mb-1">
          Catch Up — {bonusName} · Week {number}
        </p>

        <div className="bg-blue-950/60 border border-blue-700/50 rounded-2xl px-5 py-5 mb-3">
          <p className="text-white text-base font-semibold leading-snug mb-2">
            {week.description}
          </p>
          <p className="text-zinc-400 text-xs">
            {formatDate(week.startDate)} – {formatDate(week.endDate)}
          </p>
          <p className="text-zinc-500 text-xs mt-0.5">This week has ended — mark it done to catch up</p>
        </div>

        <button
          onClick={onConfirm}
          disabled={saving}
          className={cn(
            'w-full text-white font-black text-lg py-4 rounded-2xl transition-colors',
            saving
              ? 'bg-blue-900/40 cursor-wait opacity-70'
              : 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700'
          )}
        >
          {saving ? 'Saving…' : 'Mark Complete ✓'}
        </button>
        <button
          onClick={onClose}
          disabled={saving}
          className="w-full text-zinc-500 hover:text-zinc-300 text-sm font-medium py-3 transition-colors disabled:opacity-50"
        >
          Not yet
        </button>
      </div>
    </div>,
    document.body
  )
}
