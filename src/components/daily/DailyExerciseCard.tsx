'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface DailyExerciseCardProps {
  exerciseId: string
  name: string
  targetReps: number
  completedReps: number
  onChange: (exerciseId: string, reps: number) => void
  disabled?: boolean
}

const FRACTIONS = [
  { value: 0.25, label: '1/4' },
  { value: 0.5,  label: '1/2' },
  { value: 0.75, label: '3/4' },
  { value: 1,    label: 'Done ✓' },
] as const

function vibrate() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(50)
  }
}

export function DailyExerciseCard({
  exerciseId,
  name,
  targetReps,
  completedReps,
  onChange,
  disabled,
}: DailyExerciseCardProps) {
  const [showInput, setShowInput] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showInput) {
      setInputValue(completedReps > 0 ? String(completedReps) : '')
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 0)
    }
  // Only re-run when the input opens, not on every completedReps change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInput])

  const isDone = targetReps > 0 && completedReps >= targetReps

  function handleFractionTap(fraction: number) {
    vibrate()
    const reps = Math.round(targetReps * fraction)
    // Tapping the active fraction at its exact rep count toggles off
    onChange(exerciseId, completedReps === reps ? 0 : reps)
  }

  function handleCustomSubmit() {
    const parsed = parseInt(inputValue, 10)
    if (!isNaN(parsed) && parsed >= 0) {
      onChange(exerciseId, parsed)
    }
    setShowInput(false)
  }

  return (
    <div
      className={cn(
        'bg-zinc-900 border rounded-2xl p-4 transition-colors',
        isDone ? 'border-green-600/60' : 'border-zinc-800'
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="min-w-0">
            <p className={cn('font-semibold text-base', isDone ? 'text-green-400' : 'text-white')}>
              {name}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {completedReps} / {targetReps} reps
            </p>
          </div>
          <button
            onClick={() => !disabled && setShowInput(v => !v)}
            disabled={disabled}
            aria-label="Enter custom rep count"
            className={cn(
              'shrink-0 w-6 h-6 flex items-center justify-center rounded-md',
              'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              showInput && 'text-orange-400 bg-zinc-800',
            )}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>
        {isDone && (
          <div className="w-7 h-7 shrink-0 rounded-full bg-green-500/20 flex items-center justify-center ml-2">
            <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>

      {/* Custom reps input */}
      {showInput && (
        <div className="flex items-center gap-2 mb-3">
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            min={0}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCustomSubmit()
              if (e.key === 'Escape') setShowInput(false)
            }}
            placeholder="# reps"
            className="w-24 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"
          />
          <button
            onClick={handleCustomSubmit}
            className="px-3 py-1.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 active:bg-orange-700 transition-colors"
          >
            Set
          </button>
          <button
            onClick={() => setShowInput(false)}
            className="px-3 py-1.5 bg-zinc-800 text-zinc-400 rounded-xl text-sm hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Fraction buttons */}
      <div className="grid grid-cols-4 gap-2">
        {FRACTIONS.map(({ value, label }) => {
          const repThreshold = Math.round(targetReps * value)
          const isActive = completedReps >= repThreshold && completedReps > 0

          return (
            <button
              key={value}
              onClick={() => handleFractionTap(value)}
              disabled={disabled}
              className={cn(
                'py-2.5 rounded-xl text-sm font-semibold transition-all',
                'min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                isActive && value === 1
                  ? 'bg-green-600 text-white'
                  : isActive
                  ? 'bg-orange-500/30 text-orange-300 border border-orange-500/50'
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
