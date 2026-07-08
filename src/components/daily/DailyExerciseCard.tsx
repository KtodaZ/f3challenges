'use client'

import { useState, useRef, useEffect } from 'react'
import { cn, formatClock } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { ExerciseTimer } from './ExerciseTimer'
import { initTimerAudio } from '@/lib/timerAudio'
import type { ExerciseUnit } from '@/types'

interface DailyExerciseCardProps {
  exerciseId: string
  name: string
  targetReps: number
  completedReps: number
  onChange: (exerciseId: string, reps: number) => void
  disabled?: boolean
  unit?: ExerciseUnit
}

const FRACTIONS = [
  { value: 0.25, label: '1/4' },
  { value: 0.5,  label: '1/2' },
  { value: 0.75, label: '3/4' },
  { value: 1,    label: 'Done ✓' },
] as const

const QUICK_ADD = [5, 10, 15, 20, 25, 30]

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
  unit = 'reps',
}: DailyExerciseCardProps) {
  const [showModal, setShowModal] = useState(false)
  const [showTimer, setShowTimer] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const isTimed = unit === 'seconds'
  const unitLabel = isTimed ? 'sec' : 'reps'
  const progressLabel = isTimed
    ? `${formatClock(completedReps)} / ${formatClock(targetReps)}`
    : `${completedReps} / ${targetReps} ${unitLabel}`

  useEffect(() => {
    if (showModal) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [showModal])

  const isDone = targetReps > 0 && completedReps >= targetReps

  function handleFractionTap(fraction: number) {
    vibrate()
    const reps = Math.round(targetReps * fraction)
    onChange(exerciseId, completedReps === reps ? 0 : reps)
  }

  function handleQuickAdd(amount: number) {
    vibrate()
    onChange(exerciseId, completedReps + amount)
    setShowModal(false)
  }

  function handleCustomSubmit() {
    const parsed = parseInt(customValue, 10)
    if (!isNaN(parsed) && parsed >= 0) {
      onChange(exerciseId, parsed)
    }
    setShowModal(false)
  }

  return (
    <>
      <div
        className={cn(
          'bg-zinc-900 border rounded-2xl p-4 transition-colors',
          isDone ? 'border-green-600/60' : 'border-zinc-800'
        )}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0">
            <p className={cn('font-semibold text-base', isDone ? 'text-green-400' : 'text-white')}>
              {name}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5 tabular-nums">
              {progressLabel}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            {isDone && (
              <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            <button
              onClick={() => { if (!disabled) { setCustomValue(''); setShowModal(true) } }}
              disabled={disabled}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300',
              )}
            >
              {isTimed ? 'Edit time' : 'Custom reps'}
            </button>
          </div>
        </div>

        {isTimed && (
          <button
            onClick={() => {
              if (disabled) return
              initTimerAudio() // must happen inside the tap for iOS audio
              setShowTimer(true)
            }}
            disabled={disabled}
            className={cn(
              'w-full mb-2 py-3 rounded-xl text-sm font-bold transition-colors',
              'flex items-center justify-center gap-2',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              isDone
                ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                : 'bg-orange-500/15 border border-orange-500/40 text-orange-300 hover:bg-orange-500/25 active:bg-orange-500/30'
            )}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l3.5 2M12 3a9 9 0 100 18 9 9 0 000-18zM9 1.5h6" />
            </svg>
            {completedReps > 0 && !isDone ? 'Resume Timer' : 'Start Timer'}
          </button>
        )}

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

      {isTimed && (
        <ExerciseTimer
          open={showTimer}
          onClose={() => setShowTimer(false)}
          exerciseName={name}
          targetSeconds={targetReps}
          bankedSeconds={completedReps}
          onSave={total => {
            onChange(exerciseId, total)
            setShowTimer(false)
          }}
        />
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={name}
        description={`Currently: ${progressLabel}`}
      >
        <div className="space-y-4">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium mb-2">Quick add</p>
            <div className="grid grid-cols-3 gap-2">
              {QUICK_ADD.map(amount => (
                <button
                  key={amount}
                  onClick={() => handleQuickAdd(amount)}
                  className="py-3 rounded-xl bg-zinc-800 text-white font-semibold text-sm hover:bg-zinc-700 active:bg-zinc-600 transition-colors"
                >
                  +{amount} {unitLabel}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium mb-2">Set exact amount</p>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="number"
                inputMode="numeric"
                min={0}
                value={customValue}
                onChange={e => setCustomValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCustomSubmit()}
                placeholder={`# ${unitLabel}`}
                className="flex-1 px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"
              />
              <button
                onClick={handleCustomSubmit}
                className="px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 active:bg-orange-700 transition-colors"
              >
                Set
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  )
}
