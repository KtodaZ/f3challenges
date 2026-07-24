'use client'

import { cn } from '@/lib/utils'
import { getWelcomeCopy, type WelcomeMessageProps } from '@/components/home/WelcomeMessage'

/** Completion dial (percentage ring) merged with today's dynamic greeting +
 *  subtext. Replaces the separate welcome banner and the log card's ring +
 *  Update button — logging happens through Quick Tap below. */

function CompletionDial({ fraction, isDone }: { fraction: number; isDone: boolean }) {
  const size = 56
  const strokeWidth = 5
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.min(1, Math.max(0, fraction)))
  const pct = Math.round(fraction * 100)

  return (
    <div className="relative shrink-0">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#27272a" strokeWidth={strokeWidth} fill="none" />
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
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn('text-xs font-bold', isDone ? 'text-green-400' : 'text-orange-400')}>
          {pct}%
        </span>
      </div>
    </div>
  )
}

export function TodayStatusCard(props: WelcomeMessageProps) {
  const { greeting, body } = getWelcomeCopy(props)
  const fraction = props.completionFraction
  const isDone = fraction >= 1
  const inProgress = (props.loggedReps > 0 || fraction > 0) && fraction < 1

  return (
    <div
      className={cn(
        'rounded-2xl px-4 py-3 border flex items-center gap-4',
        isDone
          ? 'bg-green-950/40 border-green-800/60'
          : inProgress
          ? 'bg-orange-950/30 border-orange-800/40'
          : 'bg-zinc-900 border-zinc-800'
      )}
    >
      <CompletionDial fraction={fraction} isDone={isDone} />
      <div className="flex-1 min-w-0">
        <p className={cn(
          'font-bold text-sm',
          isDone ? 'text-green-300' : inProgress ? 'text-orange-200' : 'text-white'
        )}>
          {greeting}
        </p>
        <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{body}</p>
      </div>
    </div>
  )
}
