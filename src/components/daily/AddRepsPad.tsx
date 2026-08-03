'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { formatLoad } from '@/lib/challenges'
import type { Exercise, ExerciseLoad, LoggedSet } from '@/types'

/**
 * Rep entry for a weekly-cumulative challenge.
 *
 * The old fraction grid (1/4, 1/2, 3/4, Done) can't work here: it's sized to a
 * daily target that doesn't exist, and one tap of "1/4" would bank 75 curls —
 * a number nobody actually did. So this is additive instead: pick the variation
 * and the weight, tap what you did, done.
 *
 * Every tap logs a set, so the weight travels with the reps rather than being a
 * single sticky fact about the day: 2×20 dumbbells before work, 1×40 coupon at
 * lunch, both true. The weight is a *pending* choice — it costs nothing and
 * writes nothing until reps land on it — which is what keeps the strip
 * instant. It sticks between sessions through localStorage.
 */

interface AddRepsPadProps {
  exercises: Exercise[]
  /** Sets already logged today, oldest first. */
  todaySets: LoggedSet[]
  onAdd: (exerciseId: string, reps: number, load?: ExerciseLoad) => void | Promise<void>
  /** Drops one set by its `at` timestamp. */
  onRemoveSet: (at: string) => void | Promise<void>
  disabled?: boolean
}

const QUICK_ADD = [5, 10, 15, 20, 25, 30]
const COMMON_LBS = [10, 15, 20, 25, 30, 35, 40, 45, 50]

const LAST_EXERCISE_KEY = 'lastExerciseId'
const LAST_LBS_KEY = 'lastLoadLbs'

function vibrate() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50)
}

function readStored(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null } // private mode
}

function store(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* private mode */ }
}

export function AddRepsPad({ exercises, todaySets, onAdd, onRemoveSet, disabled }: AddRepsPadProps) {
  // Last variation used sticks across visits — most PAX have a default.
  const [selectedId, setSelectedId] = useState(() => {
    const saved = readStored(LAST_EXERCISE_KEY)
    if (saved && exercises.some(e => e.id === saved)) return saved
    return exercises[0]?.id ?? ''
  })
  // Pounds, not a full load: the pair-or-coupon half comes from the variation,
  // so the same 25 follows you from dumbbells to hammers without re-picking.
  const [lbs, setLbs] = useState<number | null>(() => {
    const saved = Number(readStored(LAST_LBS_KEY))
    return Number.isFinite(saved) && saved > 0 ? saved : null
  })
  const [customOpen, setCustomOpen] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const [weightOpen, setWeightOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = exercises.find(e => e.id === selectedId) ?? exercises[0]
  // The variation settles the shape of the weight: dumbbells and hammers come
  // as a pair, a coupon is one block. Chin-ups have no weight to log at all.
  const hands = selected?.loadHands ?? 2
  const showWeight = !selected?.bodyweight
  const load: ExerciseLoad | undefined = showWeight && lbs ? { lbs, hands } : undefined
  const loadBadge = formatLoad(load)

  const byExercise = useMemo(() => {
    const map: Record<string, number> = {}
    for (const s of todaySets) map[s.exerciseId] = (map[s.exerciseId] ?? 0) + s.reps
    return map
  }, [todaySets])
  const todayTotal = todaySets.reduce((sum, s) => sum + s.reps, 0)
  // Newest first — the set you'd most likely want to take back is on top.
  const recent = useMemo(() => [...todaySets].reverse(), [todaySets])

  useEffect(() => {
    if (customOpen) setTimeout(() => inputRef.current?.focus(), 50)
  }, [customOpen])

  // On a device that has never logged here — a new phone, a reinstalled PWA —
  // localStorage has nothing, so fall back to what today's sets say the PAX has
  // been lifting. Once, so it never fights a deliberate clear.
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current || todaySets.length === 0) return
    seeded.current = true
    if (lbs !== null) return
    const last = [...todaySets].reverse().find(s => s.load?.lbs)
    if (last?.load?.lbs) setLbs(last.load.lbs)
  }, [todaySets, lbs])

  function selectExercise(id: string) {
    setSelectedId(id)
    store(LAST_EXERCISE_KEY, id)
  }

  function pickPounds(next: number) {
    // Tapping the weight already showing turns it off — logs go in unweighted.
    const value = lbs === next ? null : next
    setLbs(value)
    store(LAST_LBS_KEY, value ? String(value) : '')
  }

  async function add(reps: number) {
    if (disabled || !selected || reps <= 0) return
    vibrate()
    await onAdd(selected.id, reps, load)
  }

  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Log curls</p>
        {todayTotal > 0 && (
          <span className="text-xs text-zinc-400 tabular-nums shrink-0">
            <span className="font-semibold text-orange-400">{todayTotal}</span> in today
          </span>
        )}
      </div>

      {/* Variation chips */}
      <div className="flex flex-wrap gap-1.5">
        {exercises.map(ex => {
          const isActive = ex.id === selected?.id
          const banked = byExercise[ex.id] ?? 0
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

      {/* Weight for the next tap. Nothing is written until reps land on it. */}
      {showWeight && (
        <div className="pt-1 border-t border-zinc-800/80">
          <button
            onClick={() => setWeightOpen(o => !o)}
            disabled={disabled}
            aria-expanded={weightOpen}
            className="w-full flex items-center justify-between gap-2 py-1.5 text-left disabled:opacity-40"
          >
            <span className="text-xs text-zinc-500 truncate">
              🏋 Logging at
              {loadBadge ? (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-xs font-bold tabular-nums">
                  {loadBadge}
                </span>
              ) : (
                <span className="ml-2 text-zinc-600">no weight</span>
              )}
            </span>
            <span className="text-zinc-600 text-xs shrink-0" aria-hidden="true">{weightOpen ? '▴' : '▾'}</span>
          </button>

          {weightOpen && (
            <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-2 no-scrollbar">
              {COMMON_LBS.map(n => (
                <button
                  key={n}
                  onClick={() => pickPounds(n)}
                  disabled={disabled}
                  className={cn(
                    'shrink-0 px-3 py-2 rounded-xl text-xs font-semibold tabular-nums transition-colors',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                    lbs === n
                      ? 'bg-amber-500/25 text-amber-200 border border-amber-500/60'
                      : 'bg-zinc-800 text-zinc-400 border border-transparent hover:bg-zinc-700'
                  )}
                >
                  {hands}×{n}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Today's sets. Doubles as the undo: each row drops itself, so a mis-tap
          three sets ago is fixable without unwinding the two after it. */}
      {recent.length > 0 && (
        <div className="pt-1 border-t border-zinc-800/80 space-y-1">
          {recent.map(set => {
            const ex = exercises.find(e => e.id === set.exerciseId)
            const badge = formatLoad(set.load)
            return (
              <div key={set.at} className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-zinc-300 tabular-nums w-10 shrink-0">+{set.reps}</span>
                <span className="text-zinc-500 truncate">{ex?.shortName ?? set.exerciseId}</span>
                {badge && (
                  <span className="text-amber-300/80 font-semibold tabular-nums shrink-0">{badge}</span>
                )}
                <button
                  onClick={() => onRemoveSet(set.at)}
                  disabled={disabled}
                  aria-label={`Remove ${set.reps} ${ex?.shortName ?? 'reps'}`}
                  className="ml-auto shrink-0 px-2 py-1 -my-1 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  function submitCustom() {
    const parsed = parseInt(customValue, 10)
    if (!isNaN(parsed) && parsed > 0) add(parsed)
    setCustomOpen(false)
  }
}
