'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { formatLoad } from '@/lib/challenges'
import { Modal } from '@/components/ui/Modal'
import { LoadPicker } from './LoadPicker'
import type { Exercise, ExerciseLoad } from '@/types'

/**
 * Rep entry for a weekly-cumulative challenge.
 *
 * The old fraction grid (1/4, 1/2, 3/4, Done) can't work here: it's sized to a
 * daily target that doesn't exist, and one tap of "1/4" would bank 75 curls —
 * a number nobody actually did. So this is additive instead: pick the variation
 * you just did, tap what you did, done. Both the variation and the weight stick
 * between sessions, so the common case is a single tap.
 */

interface AddRepsPadProps {
  exercises: Exercise[]
  /** Reps banked today, per exercise id — drives the "already in" line. */
  todayReps: Record<string, number>
  /** Weight currently attached to today's log, if any. */
  load?: ExerciseLoad
  onAdd: (exerciseId: string, reps: number) => void | Promise<void>
  onSetLoad: (load: ExerciseLoad | undefined) => void | Promise<void>
  /** Undoes the most recent add. Absent when there's nothing to undo. */
  onUndo?: () => void | Promise<void>
  disabled?: boolean
}

const QUICK_ADD = [5, 10, 15, 20, 25, 30]

function vibrate() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50)
}

export function AddRepsPad({
  exercises,
  todayReps,
  load,
  onAdd,
  onSetLoad,
  onUndo,
  disabled,
}: AddRepsPadProps) {
  // Last variation used sticks across visits — most PAX have a default.
  const [selectedId, setSelectedId] = useState(() => {
    try {
      const saved = localStorage.getItem('lastExerciseId')
      if (saved && exercises.some(e => e.id === saved)) return saved
    } catch { /* private mode */ }
    return exercises[0]?.id ?? ''
  })
  const [customOpen, setCustomOpen] = useState(false)
  const [loadOpen, setLoadOpen] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = exercises.find(e => e.id === selectedId) ?? exercises[0]

  useEffect(() => {
    if (customOpen) setTimeout(() => inputRef.current?.focus(), 50)
  }, [customOpen])

  function selectExercise(id: string) {
    setSelectedId(id)
    try { localStorage.setItem('lastExerciseId', id) } catch { /* private mode */ }
  }

  async function add(amount: number) {
    if (disabled || !selected || amount <= 0) return
    vibrate()
    await onAdd(selected.id, amount)
  }

  const todayTotal = Object.values(todayReps).reduce((s, n) => s + n, 0)
  const loadBadge = formatLoad(load)
  // Chin-ups can't take a weight, so the picker stays out of the way for them.
  const showLoad = !selected?.bodyweight

  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Log curls</p>
        {todayTotal > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-zinc-400 tabular-nums">
              <span className="font-semibold text-orange-400">{todayTotal}</span> in today
            </span>
            {onUndo && (
              <button
                onClick={() => onUndo()}
                disabled={disabled}
                className="text-xs text-zinc-500 underline hover:text-zinc-300 disabled:opacity-40"
              >
                Undo
              </button>
            )}
          </div>
        )}
      </div>

      {/* Variation chips */}
      <div className="flex flex-wrap gap-1.5">
        {exercises.map(ex => {
          const isActive = ex.id === selected?.id
          const banked = todayReps[ex.id] ?? 0
          return (
            <button
              key={ex.id}
              onClick={() => selectExercise(ex.id)}
              disabled={disabled}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                isActive
                  ? 'bg-orange-500/25 text-orange-200 border-orange-500/60'
                  : 'bg-zinc-800 text-zinc-400 border-transparent hover:bg-zinc-700'
              )}
            >
              {ex.shortName}
              {banked > 0 && (
                <span className={cn('ml-1.5 tabular-nums', isActive ? 'text-orange-300/80' : 'text-zinc-500')}>
                  {banked}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Quick add */}
      <div className="grid grid-cols-4 gap-2">
        {QUICK_ADD.map(amount => (
          <button
            key={amount}
            onClick={() => add(amount)}
            disabled={disabled}
            className={cn(
              'py-3 rounded-xl text-sm font-bold tabular-nums transition-all min-h-[44px]',
              'bg-zinc-800 text-white hover:bg-zinc-700 active:bg-orange-600',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          >
            +{amount}
          </button>
        ))}
        <button
          onClick={() => { setCustomValue(''); setCustomOpen(true) }}
          disabled={disabled}
          className={cn(
            'py-3 rounded-xl text-sm font-semibold transition-colors min-h-[44px]',
            'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200',
            'disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          Other
        </button>
        {showLoad ? (
          <button
            onClick={() => setLoadOpen(true)}
            disabled={disabled}
            className={cn(
              'py-3 rounded-xl text-xs font-semibold transition-colors min-h-[44px] truncate px-1',
              loadBadge
                ? 'bg-amber-500/15 text-amber-300 border border-amber-600/40 hover:bg-amber-500/25'
                : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          >
            {loadBadge ? `🏋 ${loadBadge}` : '🏋 Weight'}
          </button>
        ) : (
          <div className="flex items-center justify-center text-xs text-zinc-600 font-semibold">BW</div>
        )}
      </div>

      {/* Custom amount */}
      <Modal
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        title={selected?.name ?? 'Add reps'}
        description="How many did you just knock out?"
      >
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            min={1}
            value={customValue}
            onChange={e => setCustomValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitCustom() }}
            placeholder="# reps"
            className="flex-1 px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"
          />
          <button
            onClick={submitCustom}
            className="px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 active:bg-orange-700 transition-colors"
          >
            Add
          </button>
        </div>
      </Modal>

      <LoadPicker
        // Remount on each open so the picker re-seeds from the saved weight.
        key={loadOpen ? 'open' : 'closed'}
        open={loadOpen}
        onClose={() => setLoadOpen(false)}
        value={load}
        onSave={next => { onSetLoad(next); setLoadOpen(false) }}
      />
    </div>
  )

  function submitCustom() {
    const parsed = parseInt(customValue, 10)
    if (!isNaN(parsed) && parsed > 0) add(parsed)
    setCustomOpen(false)
  }
}
