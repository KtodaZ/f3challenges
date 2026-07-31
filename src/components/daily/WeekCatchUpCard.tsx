'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import type { Exercise, WeekProgress } from '@/types'

/**
 * Topping up a week that already closed short.
 *
 * A closed week is never a closed book — same philosophy as Catch Up on the
 * day-scored challenges. Reps added here land on the week's final day and are
 * flagged as make-ups, so they still climb the trophy ladder without
 * pretending they happened on time.
 */

interface WeekCatchUpCardProps {
  weeks: WeekProgress[]
  exercises: Exercise[]
  onAdd: (weekEndDate: string, exerciseId: string, reps: number) => Promise<void>
  savingWeek?: string | null
}

const QUICK_ADD = [10, 20, 25, 50]

export function WeekCatchUpCard({ weeks, exercises, onAdd, savingWeek }: WeekCatchUpCardProps) {
  const [openWeek, setOpenWeek] = useState<WeekProgress | null>(null)
  const [exerciseId, setExerciseId] = useState(exercises[0]?.id ?? '')
  const [amount, setAmount] = useState('')

  if (weeks.length === 0) return null

  async function add(reps: number) {
    if (!openWeek || reps <= 0) return
    await onAdd(openWeek.week.endDate, exerciseId, reps)
    setOpenWeek(null)
    setAmount('')
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <span className="text-base">⏳</span>
          <h2 className="text-sm font-bold text-white">Catch Up</h2>
          <span className="text-zinc-500 text-xs">— finish a week you came up short on</span>
        </div>

        {weeks.map(w => {
          const pct = Math.round(w.fraction * 100)
          const saving = savingWeek === w.week.endDate
          return (
            <button
              key={w.week.startDate}
              onClick={() => setOpenWeek(w)}
              disabled={saving}
              className={cn(
                'w-full rounded-2xl border border-amber-800/40 bg-amber-950/20 px-4 py-3',
                'flex items-center gap-3 text-left transition-colors',
                'hover:bg-amber-950/40 disabled:opacity-60'
              )}
            >
              <span className="text-xl shrink-0" aria-hidden="true">⏪</span>
              <div className="flex-1 min-w-0">
                <p className="text-amber-300 font-bold text-sm">
                  Week {w.week.index} · {w.remaining.toLocaleString()} short
                </p>
                <div className="mt-1.5 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <span className="text-xs font-bold text-amber-300 shrink-0 tabular-nums">
                {saving ? '…' : `${w.reps.toLocaleString()}/${w.target.toLocaleString()}`}
              </span>
            </button>
          )
        })}
      </div>

      <Modal
        open={openWeek !== null}
        onClose={() => setOpenWeek(null)}
        title={openWeek ? `Top up Week ${openWeek.week.index}` : ''}
        description={
          openWeek
            ? `${openWeek.remaining.toLocaleString()} reps short of ${openWeek.target.toLocaleString()}. These count as a make-up.`
            : ''
        }
      >
        <div className="space-y-4">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium mb-2">Variation</p>
            <div className="flex flex-wrap gap-1.5">
              {exercises.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => setExerciseId(ex.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors',
                    ex.id === exerciseId
                      ? 'bg-amber-500/25 text-amber-200 border-amber-500/60'
                      : 'bg-zinc-800 text-zinc-400 border-transparent hover:bg-zinc-700'
                  )}
                >
                  {ex.shortName}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium mb-2">Add reps</p>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {QUICK_ADD.map(n => (
                <button
                  key={n}
                  onClick={() => add(n)}
                  className="py-3 rounded-xl bg-zinc-800 text-white font-bold text-sm tabular-nums hover:bg-zinc-700 active:bg-amber-600 transition-colors"
                >
                  +{n}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="# reps"
                className="flex-1 px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={() => {
                  const n = parseInt(amount, 10)
                  if (!isNaN(n) && n > 0) add(n)
                }}
                className="px-4 py-2.5 bg-amber-500 text-zinc-950 rounded-xl text-sm font-bold hover:bg-amber-400 transition-colors"
              >
                Add
              </button>
            </div>
            {openWeek && openWeek.remaining > 0 && (
              <button
                onClick={() => add(openWeek.remaining)}
                className="w-full mt-2 py-2.5 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-600/40 text-sm font-semibold hover:bg-amber-500/25 transition-colors"
              >
                Finish it — add all {openWeek.remaining.toLocaleString()}
              </button>
            )}
          </div>
        </div>
      </Modal>
    </>
  )
}
