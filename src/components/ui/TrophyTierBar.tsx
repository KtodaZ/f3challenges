'use client'

import { TROPHY_TIERS, tierDaysRequired } from '@/lib/challenges'
import { TROPHY_TIER_STYLES } from '@/lib/trophyStyles'
import { cn } from '@/lib/utils'
import type { ChallengeTemplate, TrophyProgress } from '@/types'

interface TrophyTierBarProps {
  challenge: ChallengeTemplate
  progress: TrophyProgress
  /** Hide the 🥉/🥈/🥇 rungs under the bar for tight spots. */
  showRungs?: boolean
  className?: string
}

/**
 * Progress across the whole challenge with the three trophy rungs marked:
 * 🥉 Bronze at half the days, 🥈 Silver at 80%, 🥇 Gold at every day. Earned
 * rungs light up; the one you're chasing is outlined.
 */
export function TrophyTierBar({ challenge, progress, showRungs = true, className }: TrophyTierBarProps) {
  const rungs = TROPHY_TIERS.filter(t => t.tier !== 'participant')
  const fillTier = progress.earned?.tier ?? 'participant'
  const pct = Math.round(progress.fraction * 100)

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="relative h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', TROPHY_TIER_STYLES[fillTier].bar)}
          style={{ width: `${Math.max(pct, progress.completedDays > 0 ? 3 : 0)}%` }}
        />
        {/* Rung markers sit on the track so the gaps are visible at a glance */}
        {rungs.slice(0, -1).map(rung => (
          <div
            key={rung.tier}
            aria-hidden="true"
            className="absolute top-0 bottom-0 w-px bg-zinc-950/80"
            style={{ left: `${rung.threshold * 100}%` }}
          />
        ))}
      </div>

      {showRungs && (
        // Exact positions live on the bar (the tick marks above); the labels
        // sit in fixed columns so they can never collide on a narrow phone.
        <div className="flex items-center justify-between gap-1">
          {rungs.map(rung => {
            const days = tierDaysRequired(challenge, rung.tier)
            const earned = progress.completedDays >= days
            const isNext = progress.next?.tier === rung.tier
            return (
              <span
                key={rung.tier}
                className={cn(
                  'whitespace-nowrap text-[10px] font-semibold px-1.5 py-0.5 rounded-full border leading-none flex items-center gap-1',
                  earned
                    ? TROPHY_TIER_STYLES[rung.tier].chip
                    : isNext
                    ? 'bg-zinc-900 border-zinc-600 text-zinc-300'
                    : 'bg-transparent border-transparent text-zinc-600'
                )}
              >
                <span className={cn(!earned && 'grayscale opacity-60')}>{rung.emoji}</span>
                {rung.label} · {days}d
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
