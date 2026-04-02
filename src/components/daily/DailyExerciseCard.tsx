'use client'

import { cn } from '@/lib/utils'
import type { CompletionFraction } from '@/types'

interface DailyExerciseCardProps {
  exerciseId: string
  name: string
  targetReps: number
  fraction: CompletionFraction
  onChange: (exerciseId: string, fraction: CompletionFraction) => void
  disabled?: boolean
}

const FRACTIONS: { value: CompletionFraction; label: string }[] = [
  { value: 0.25, label: '1/4' },
  { value: 0.5,  label: '1/2' },
  { value: 0.75, label: '3/4' },
  { value: 1,    label: 'Done ✓' },
]

function vibrate() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(50)
  }
}

export function DailyExerciseCard({
  exerciseId,
  name,
  targetReps,
  fraction,
  onChange,
  disabled,
}: DailyExerciseCardProps) {
  const completedReps = Math.round(targetReps * fraction)
  const isDone = fraction >= 1

  function handleTap(val: CompletionFraction) {
    vibrate()
    // Tapping the active button toggles it off (back to 0)
    onChange(exerciseId, fraction === val ? 0 : val)
  }

  return (
    <div
      className={cn(
        'bg-zinc-900 border rounded-2xl p-4 transition-colors',
        isDone ? 'border-green-600/60' : 'border-zinc-800'
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className={cn('font-semibold text-base', isDone ? 'text-green-400' : 'text-white')}>
            {name}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {completedReps} / {targetReps} reps
          </p>
        </div>
        {isDone && (
          <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>

      {/* Fraction buttons */}
      <div className="grid grid-cols-4 gap-2">
        {FRACTIONS.map(({ value, label }) => {
          const isActive = fraction >= value && fraction > 0
          const isSelected = fraction === value

          return (
            <button
              key={value}
              onClick={() => handleTap(value)}
              disabled={disabled}
              className={cn(
                'py-2.5 rounded-xl text-sm font-semibold transition-all',
                'min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                isActive && value === 1
                  ? 'bg-green-600 text-white'
                  : isActive
                  ? 'bg-orange-500/30 text-orange-300 border border-orange-500/50'
                  : isSelected
                  ? 'bg-orange-500 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 active:bg-zinc-600'
              )}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
