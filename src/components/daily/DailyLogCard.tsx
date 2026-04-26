'use client'

import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import type { DailyLog, DailyTarget } from '@/types'

interface DailyLogCardProps {
  log: DailyLog | null
  target: DailyTarget
  onOpenLog: () => void
}

function CompletionRing({ fraction }: { fraction: number }) {
  const size = 56
  const strokeWidth = 5
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.min(1, Math.max(0, fraction)))
  const isDone = fraction >= 1

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#27272a"
        strokeWidth={strokeWidth}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={isDone ? '#22c55e' : '#f97316'}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-500"
      />
    </svg>
  )
}

export function DailyLogCard({ log, target, onOpenLog }: DailyLogCardProps) {
  const fraction = log?.completionFraction ?? 0
  const isDone = fraction >= 1
  const pct = Math.round(fraction * 100)


  const statusLabel = isDone
    ? 'All done today!'
    : fraction > 0
    ? `${pct}% complete`
    : 'Not started yet'

  const exerciseSummary = log && log.exerciseLogs.length > 0
    ? log.exerciseLogs
        .map(el => {
          const ex = target.exercises.find(e => e.exercise.id === el.exerciseId)
          if (!ex) return null
          const unit = ex.exercise.unit ?? 'reps'
          return `${el.completedReps}${unit === 'seconds' ? 's' : ''} ${ex.exercise.shortName}`
        })
        .filter(Boolean)
        .join(' · ')
    : null

  return (
    <Card className="flex items-center gap-4">
      {/* Completion ring */}
      <div className="relative shrink-0">
        <CompletionRing fraction={fraction} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('text-xs font-bold', isDone ? 'text-green-400' : 'text-orange-400')}>
            {pct}%
          </span>
        </div>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={cn('font-bold text-base', isDone ? 'text-green-400' : 'text-white')}>
          {statusLabel}
        </p>
        {exerciseSummary ? (
          <p className="text-xs text-zinc-500 mt-0.5 truncate">{exerciseSummary}</p>
        ) : (
          <p className="text-xs text-zinc-500 mt-0.5">
            {target.totalReps > 0
              ? `Goal: ${target.totalReps} reps today`
              : `Goal: ${target.exercises.map(e => `${e.reps}${(e.exercise.unit ?? 'reps') === 'seconds' ? 's' : ''} ${e.exercise.shortName}`).join(' · ')}`
            }
          </p>
        )}
      </div>

      {/* CTA */}
      <Button
        variant={isDone ? 'success' : 'primary'}
        size="sm"
        onClick={onOpenLog}
        className="shrink-0"
      >
        {isDone ? 'Update' : log ? 'Update' : 'Log'}
      </Button>
    </Card>
  )
}
