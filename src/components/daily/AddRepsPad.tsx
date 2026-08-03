'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { formatLoad } from '@/lib/challenges'
import type { Exercise, ExerciseLoad } from '@/types'

/**
 * Rep entry for a weekly-cumulative challenge.
 *
 * The old fraction grid (1/4, 1/2, 3/4, Done) can't work here: it's sized to a
 * daily target that doesn't exist, and one tap of "1/4" would bank 75 curls —
 * a number nobody actually did. So this is additive instead: pick the variation
 * you just did, tap what you did, done. Both the variation and the weight stick
 * between sessions, so the common case is a single tap.
 *
 * Everything lives on this one card on purpose. Weight used to be a modal whose
 * grid of numbers (10, 15, 20, 25…) was a dead ringer for the grid of rep
 * buttons behind it — two screens asking what looked like the same question.
 * Now weight is a quiet inline strip: pounds only, since "one, two, or a
 * coupon" is already answered by the variation you picked.
 */

interface AddRepsPadProps {
  exercises: Exercise[]
  /** Reps banked today, per exercise id — drives the "already in" line. */
  todayReps: Record<string, number>
  /** Weight currently attached to today's log, if any. */
  load?: ExerciseLoad
  onAdd: (exerciseId: string, reps: number) => void | Promise<void>
  /** Pass null to clear the weight entirely. */
  onSetLoad: (load: ExerciseLoad | null) => void | Promise<void>
  /** Undoes the most recent add. Absent when there's nothing to undo. */
  onUndo?: () => void | Promise<void>
  disabled?: boolean
}

const QUICK_ADD = [5, 10, 15, 20, 25, 30]
const COMMON_LBS = [10, 15, 20, 25, 30, 35, 40, 45, 50]

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
  const [customValue, setCustomValue] = useState('')
  const [weightOpen, setWeightOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = exercises.find(e => e.id === selectedId) ?? exercises[0]

  // Weight saves on tap like reps do, but the write round-trips through
  // Firestore before `load` comes back — so the strip renders this optimistic
  // copy and lets the saved value take over once it lands.
  const [draftLoad, setDraftLoad] = useState<ExerciseLoad | undefined>(load)
  useEffect(() => { setDraftLoad(load) }, [load])

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

  function applyLoad(next: ExerciseLoad | null) {
    setDraftLoad(next ?? undefined)
    onSetLoad(next)
  }

  const todayTotal = Object.values(todayReps).reduce((s, n) => s + n, 0)
  const loadBadge = formatLoad(draftLoad)
  // A coupon is one implement in both hands, so its weight is a total, not a
  // per-hand number. Chin-ups take no weight at all — only "BW".
  const perHand = !selected?.bothHands && !selected?.bodyweight
  const hands = draftLoad?.hands ?? 2

  function pickPounds(lbs: number) {
    const next: ExerciseLoad = perHand ? { lbs, hands } : { lbs }
    // Tapping the weight already showing turns it off. Same number in a
    // different shape (a pair of 25s vs a 25 lb coupon) is a change, not a
    // second tap, so it saves instead of clearing.
    const unchanged = draftLoad?.lbs === next.lbs && draftLoad?.hands === next.hands
    applyLoad(unchanged ? null : next)
  }

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

      {/* Quick add — the whole point of the card, so it gets the big targets */}
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
        {!customOpen && (
          <button
            onClick={() => { setCustomValue(''); setCustomOpen(true) }}
            disabled={disabled}
            className={cn(
              'col-span-2 py-3 rounded-xl text-sm font-semibold transition-colors min-h-[44px]',
              'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          >
            Other
          </button>
        )}
        {/* Some other number of reps — an input in the grid rather than a
            modal, so nothing about logging ever leaves this card. */}
        {customOpen && (
          <div className="col-span-2 flex gap-2">
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
              onBlur={() => { if (!customValue) setCustomOpen(false) }}
              placeholder="# reps"
              aria-label="Number of reps"
              className={cn(
                'w-full min-w-0 px-3 rounded-xl bg-zinc-800 border border-orange-500/60',
                'text-white text-sm tabular-nums focus:outline-none',
                '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
              )}
            />
            <button
              onClick={submitCustom}
              disabled={disabled}
              className="px-4 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 active:bg-orange-700 disabled:opacity-40 transition-colors"
            >
              Add
            </button>
          </div>
        )}
      </div>

      {/* Weight — optional, set once a month, so it stays a quiet footer.
          Collapsed it's just the badge; open it's one row of pounds. */}
      <div className="pt-1 border-t border-zinc-800/80">
        <button
          onClick={() => setWeightOpen(o => !o)}
          disabled={disabled}
          aria-expanded={weightOpen}
          className="w-full flex items-center justify-between gap-2 py-1.5 text-left disabled:opacity-40"
        >
          <span className="text-xs text-zinc-500 truncate">
            🏋 Weight
            {loadBadge ? (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-xs font-bold tabular-nums">
                {loadBadge}
              </span>
            ) : (
              <span className="ml-2 text-zinc-600">optional badge</span>
            )}
          </span>
          <span className="text-zinc-600 text-xs shrink-0" aria-hidden="true">{weightOpen ? '▴' : '▾'}</span>
        </button>

        {weightOpen && (
          <div className="pb-1 space-y-2">
            {selected?.bodyweight ? (
              <button
                onClick={() => applyLoad(draftLoad?.bodyweight ? null : { bodyweight: true })}
                className={cn(
                  'px-3 py-2 rounded-xl text-xs font-semibold transition-colors',
                  draftLoad?.bodyweight
                    ? 'bg-amber-500/25 text-amber-200 border border-amber-500/60'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                )}
              >
                Bodyweight
              </button>
            ) : (
              <>
                {/* Pounds. Tap saves — no second confirm, same as the rep
                    buttons. Scrolls sideways so it stays one line. */}
                <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1 no-scrollbar">
                  {COMMON_LBS.map(n => (
                    <button
                      key={n}
                      onClick={() => pickPounds(n)}
                      disabled={disabled}
                      className={cn(
                        'shrink-0 px-3 py-2 rounded-xl text-xs font-semibold tabular-nums transition-colors',
                        'disabled:opacity-40 disabled:cursor-not-allowed',
                        draftLoad?.lbs === n
                          ? 'bg-amber-500/25 text-amber-200 border border-amber-500/60'
                          : 'bg-zinc-800 text-zinc-400 border border-transparent hover:bg-zinc-700'
                      )}
                    >
                      {n} lb
                    </button>
                  ))}
                </div>
                {/* Only worth asking once there's a weight to qualify. */}
                {perHand && draftLoad?.lbs ? (
                  <div className="flex gap-2">
                    {([
                      { v: 2 as const, label: 'A pair' },
                      { v: 1 as const, label: 'One arm' },
                    ]).map(opt => (
                      <button
                        key={opt.v}
                        onClick={() => applyLoad({ lbs: draftLoad.lbs, hands: opt.v })}
                        disabled={disabled}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors',
                          'disabled:opacity-40 disabled:cursor-not-allowed',
                          hands === opt.v
                            ? 'bg-zinc-700 text-zinc-100'
                            : 'bg-zinc-800/60 text-zinc-500 hover:bg-zinc-700/60'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )

  function submitCustom() {
    const parsed = parseInt(customValue, 10)
    if (!isNaN(parsed) && parsed > 0) add(parsed)
    setCustomOpen(false)
  }
}
