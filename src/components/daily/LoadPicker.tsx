'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { formatLoad } from '@/lib/challenges'
import { Modal } from '@/components/ui/Modal'
import type { ExerciseLoad } from '@/types'

/**
 * Optional weight for a session. Deliberately coarse — one weight per log
 * rather than one per variation. Nobody fills in four numbers on their phone
 * mid-workout, and the point is bragging rights on the leaderboard, not a
 * training log.
 */

interface LoadPickerProps {
  open: boolean
  onClose: () => void
  value?: ExerciseLoad
  /** Pass undefined to clear the weight entirely. */
  onSave: (load: ExerciseLoad | undefined) => void
}

const COMMON_LBS = [10, 15, 20, 25, 30, 35, 40, 45, 50]

/**
 * Seeded from `value` on mount. The parent remounts this on every open (see
 * the `key` in AddRepsPad), which is what re-seeds it — so cancelling never
 * leaves stale edits behind, without an effect that writes state on open.
 */
export function LoadPicker({ open, onClose, value, onSave }: LoadPickerProps) {
  const [lbs, setLbs] = useState<string>(value?.lbs ? String(value.lbs) : '')
  const [hands, setHands] = useState<1 | 2 | undefined>(value?.hands ?? 2)

  const parsed = parseInt(lbs, 10)
  const valid = !isNaN(parsed) && parsed > 0
  const preview = formatLoad(valid ? { lbs: parsed, hands } : undefined)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Weight used"
      description="Optional — it just shows up as a badge next to your name."
    >
      <div className="space-y-4">
        {/* One dumbbell, two, or a single implement held with both hands */}
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium mb-2">How many</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { v: 2 as const, label: 'Two',    sub: 'a pair' },
              { v: 1 as const, label: 'One',    sub: 'single arm' },
              { v: undefined,  label: 'Coupon', sub: 'both hands' },
            ]).map(opt => (
              <button
                key={opt.label}
                onClick={() => setHands(opt.v)}
                className={cn(
                  'py-2.5 rounded-xl text-sm font-semibold border transition-colors',
                  hands === opt.v
                    ? 'bg-amber-500/25 text-amber-200 border-amber-500/60'
                    : 'bg-zinc-800 text-zinc-400 border-transparent hover:bg-zinc-700'
                )}
              >
                {opt.label}
                <span className="block text-[10px] font-normal opacity-70">{opt.sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Pounds */}
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium mb-2">Pounds</p>
          <div className="grid grid-cols-5 gap-2 mb-2">
            {COMMON_LBS.map(n => (
              <button
                key={n}
                onClick={() => setLbs(String(n))}
                className={cn(
                  'py-2 rounded-xl text-sm font-semibold tabular-nums transition-colors',
                  parsed === n
                    ? 'bg-amber-500/25 text-amber-200 border border-amber-500/60'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={lbs}
            onChange={e => setLbs(e.target.value)}
            placeholder="Other weight"
            className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
          />
        </div>

        {preview && (
          <p className="text-sm text-zinc-400 text-center">
            Shows as{' '}
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-xs font-bold tabular-nums">
              {preview}
            </span>
          </p>
        )}

        <div className="flex gap-2">
          {value && (
            <button
              onClick={() => onSave(undefined)}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-400 text-sm font-semibold hover:bg-zinc-700"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => onSave(valid ? { lbs: parsed, hands } : undefined)}
            disabled={!valid}
            className="flex-1 px-4 py-2.5 bg-amber-500 text-zinc-950 rounded-xl text-sm font-bold hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  )
}
