'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { cn, formatClock } from '@/lib/utils'
import type { Exercise } from '@/types'

/**
 * Topping up a day that's already finished.
 *
 * The day's cards come down at 100% — finishing is the point — and the fraction
 * grid can't be reused above target anyway: its "Done ✓" *sets* you back to the
 * target, so a PAX sitting on 150 would tap it and quietly lose 50. So extra
 * reps get their own surface, and it is additive only. Every tap appends, no
 * control sets an absolute, and undo can only take back reps added in this
 * sitting — never the ones that finished the day. A finished day stays finished.
 *
 * Behind a modal on purpose. These reps rank on the leaderboard, so the tap
 * that banks them should be one the PAX meant to make.
 */

const QUICK_ADD_REPS = [5, 10, 15, 20, 25, 30]
const QUICK_ADD_SECONDS = [15, 30, 45, 60, 90, 120]

interface Addition {
  key: string
  exerciseId: string
  amount: number
}

interface ExtraRepsModalProps {
  open: boolean
  onClose: () => void
  /** The exercises the PAX just finished — today's target, in order. */
  exercises: Array<{ exercise: Exercise; reps: number }>
  /** Reps already banked per exercise, snapshotted when the modal opened. */
  baseline: Record<string, number>
  /** Writes an exercise's new absolute total for today. */
  onSetTotal: (exerciseId: string, total: number) => void | Promise<void>
  saving?: boolean
}

function vibrate() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50)
}

export function ExtraRepsModal({
  open,
  onClose,
  exercises,
  baseline,
  onSetTotal,
  saving,
}: ExtraRepsModalProps) {
  const [additions, setAdditions] = useState<Addition[]>([])
  const [selectedId, setSelectedId] = useState(() => exercises[0]?.exercise.id ?? '')
  const [customOpen, setCustomOpen] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const seq = useRef(0)

  // Closing clears the session, so the next opening starts empty. That's what
  // keeps undo honest: the list only ever holds reps added since you opened it,
  // and there's nothing in it that could walk the day back below its target.
  // Every exit — the X, Escape, the overlay, the Done button — lands here.
  function handleClose() {
    setAdditions([])
    setCustomOpen(false)
    setCustomValue('')
    setSelectedId(exercises[0]?.exercise.id ?? '')
    onClose()
  }

  useEffect(() => {
    if (customOpen) setTimeout(() => inputRef.current?.focus(), 50)
  }, [customOpen])

  const selected = exercises.find(e => e.exercise.id === selectedId) ?? exercises[0]
  const isTimed = selected?.exercise.unit === 'seconds'
  const unitLabel = isTimed ? 'sec' : 'reps'
  const quickAdd = isTimed ? QUICK_ADD_SECONDS : QUICK_ADD_REPS

  const addedByExercise = useMemo(() => {
    const map: Record<string, number> = {}
    for (const a of additions) map[a.exerciseId] = (map[a.exerciseId] ?? 0) + a.amount
    return map
  }, [additions])

  // Newest first — the tap you'd want back is the one you just made.
  const recent = useMemo(() => [...additions].reverse(), [additions])
  const selectedAdded = selected ? addedByExercise[selected.exercise.id] ?? 0 : 0
  const selectedTotal = selected ? (baseline[selected.exercise.id] ?? 0) + selectedAdded : 0

  function commit(exerciseId: string, list: Addition[]) {
    const added = list.reduce((sum, a) => (a.exerciseId === exerciseId ? sum + a.amount : sum), 0)
    // Absolute, recomputed from the snapshot rather than nudged — a dropped
    // write can't drift the total, and the floor is always what you'd banked
    // before you opened this.
    return onSetTotal(exerciseId, (baseline[exerciseId] ?? 0) + added)
  }

  async function add(amount: number) {
    if (saving || !selected || amount <= 0) return
    vibrate()
    // The counter never resets, so a key stays unique even across reopenings.
    const next = [
      ...additions,
      { key: `add_${seq.current++}`, exerciseId: selected.exercise.id, amount },
    ]
    setAdditions(next)
    await commit(selected.exercise.id, next)
  }

  async function undo(key: string) {
    if (saving) return
    const dropped = additions.find(a => a.key === key)
    if (!dropped) return
    const next = additions.filter(a => a.key !== key)
    setAdditions(next)
    await commit(dropped.exerciseId, next)
  }

  function submitCustom() {
    const parsed = parseInt(customValue, 10)
    if (!isNaN(parsed) && parsed > 0) add(parsed)
    setCustomOpen(false)
    setCustomValue('')
  }

  function format(amount: number) {
    return isTimed ? formatClock(amount) : `${amount}`
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Log extra reps"
      description="Your day's already counted. Anything you add here is on top of it."
    >
      <div className="space-y-4">
        {/* Which exercise the next tap lands on. A single-exercise day has
            nothing to choose, so it doesn't get asked. */}
        {exercises.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {exercises.map(({ exercise }) => {
              const isActive = exercise.id === selected?.exercise.id
              const added = addedByExercise[exercise.id] ?? 0
              return (
                <button
                  key={exercise.id}
                  onClick={() => setSelectedId(exercise.id)}
                  disabled={saving}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                    isActive
                      ? 'bg-orange-500/25 text-orange-200 border-orange-500/60'
                      : 'bg-zinc-800 text-zinc-400 border-transparent hover:bg-zinc-700'
                  )}
                >
                  {exercise.shortName}
                  {added > 0 && (
                    <span
                      className={cn(
                        'ml-1.5 tabular-nums',
                        isActive ? 'text-orange-300/80' : 'text-zinc-500'
                      )}
                    >
                      +{added}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {selected && (
          <p className="text-xs text-zinc-500">
            <span className="font-semibold text-zinc-300">{selected.exercise.name}</span>
            {' — '}
            <span className="tabular-nums">{format(selectedTotal)}</span> {unitLabel} today
            {selectedAdded > 0 && (
              <span className="text-orange-400 font-semibold tabular-nums">
                {' '}(+{format(selectedAdded)} extra)
              </span>
            )}
          </p>
        )}

        <div className="grid grid-cols-3 gap-2">
          {quickAdd.map(amount => (
            <button
              key={amount}
              onClick={() => add(amount)}
              disabled={saving}
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
          {!customOpen && (
            <button
              onClick={() => { setCustomValue(''); setCustomOpen(true) }}
              disabled={saving}
              className={cn(
                'col-span-3 py-3 rounded-xl text-sm font-semibold transition-colors min-h-[44px]',
                'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200',
                'disabled:opacity-40 disabled:cursor-not-allowed'
              )}
            >
              Other
            </button>
          )}
          {customOpen && (
            <div className="col-span-3 flex gap-2">
              <input
                ref={inputRef}
                type="number"
                inputMode="numeric"
                min={1}
                value={customValue}
                onChange={e => setCustomValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') submitCustom()
                  if (e.key === 'Escape') setCustomOpen(false)
                }}
                placeholder={`# ${unitLabel}`}
                aria-label={`Extra ${unitLabel}`}
                className={cn(
                  'w-full min-w-0 px-3 py-2.5 rounded-xl bg-zinc-800 border border-orange-500/60',
                  'text-white text-sm tabular-nums focus:outline-none',
                  '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
                )}
              />
              <button
                onClick={submitCustom}
                disabled={saving}
                className="px-4 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 active:bg-orange-700 disabled:opacity-40 transition-colors"
              >
                Add
              </button>
            </div>
          )}
        </div>

        {/* What this sitting added, each row taking itself back. Nothing from
            before you opened the modal is listed — those reps aren't yours to
            undo here. */}
        {recent.length > 0 && (
          <div className="pt-3 border-t border-zinc-800 space-y-1">
            <p className="text-xs text-zinc-500">Added just now:</p>
            {recent.map(a => {
              const ex = exercises.find(e => e.exercise.id === a.exerciseId)?.exercise
              return (
                <div key={a.key} className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-orange-400 tabular-nums w-12 shrink-0">
                    +{a.amount}
                  </span>
                  <span className="text-zinc-500 truncate">{ex?.shortName ?? a.exerciseId}</span>
                  <button
                    onClick={() => undo(a.key)}
                    disabled={saving}
                    aria-label={`Undo ${a.amount} ${ex?.shortName ?? ''}`}
                    className="ml-auto shrink-0 px-2 py-1 -my-1 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <button
          onClick={handleClose}
          className="w-full py-3 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-semibold hover:bg-zinc-700 transition-colors"
        >
          Done
        </button>
      </div>
    </Modal>
  )
}
