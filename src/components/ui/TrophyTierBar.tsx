'use client'

import { getTrophyTier, getTrophyTiers, tierAmountRequired } from '@/lib/challenges'
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

/** Rung amount, kept short enough that three chips fit a narrow phone: "14d",
 *  "675", "1.4k". The exact figures live in the summary line above the bar. */
function unitShort(progress: TrophyProgress, amount: number): string {
  if (progress.unit.unit === 'day') return `${amount}d`
  if (amount < 1000) return String(amount)
  // 1350 → "1.4k", 2000 → "2k". Rep challenges cross 1,000 by Silver, so
  // spelling the figure out is what pushed the row past the screen edge.
  return `${(amount / 1000).toFixed(1).replace(/\.0$/, '')}k`
}

/**
 * Progress across the whole challenge with the three trophy rungs marked:
 * 🥉 Bronze at half, 🥈 Silver at 75%, 🥇 Gold at all of it — measured in
 * whichever unit the challenge scores (days, or reps for weekly-cumulative).
 * Earned rungs light up; the one you're chasing is outlined.
 */
export function TrophyTierBar({ challenge, progress, showRungs = true, className }: TrophyTierBarProps) {
  // Themed for this challenge — August hands out Bronze/Silver/Gold Bicep.
  const rungs = getTrophyTiers(challenge).filter(t => t.tier !== 'participant')
  const fillTier = progress.earned?.tier ?? 'participant'
  const pct = Math.round(progress.fraction * 100)

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="relative h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', TROPHY_TIER_STYLES[fillTier].bar)}
          style={{ width: `${Math.max(pct, progress.completed > 0 ? 3 : 0)}%` }}
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
        // overflow-hidden is the backstop: three nowrap chips that don't fit
        // would otherwise widen the whole page, not just this row.
        <div className="flex items-center justify-between gap-1 overflow-hidden">
          {rungs.map(rung => {
            const amount = tierAmountRequired(challenge, rung.tier)
            const earned = progress.completed >= amount
            const isNext = progress.next?.tier === rung.tier
            // The plain tier word, not the themed one: "Bronze Bicep · 675"
            // three times over is wider than a phone. The themed name is
            // already in the headline above the bar, and the emoji stays
            // themed, so the month still reads as its own.
            const label = getTrophyTier(rung.tier).label
            return (
              <span
                key={rung.tier}
                className={cn(
                  'min-w-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border leading-none flex items-center gap-1',
                  earned
                    ? TROPHY_TIER_STYLES[rung.tier].chip
                    : isNext
                    ? 'bg-zinc-900 border-zinc-600 text-zinc-300'
                    : 'bg-transparent border-transparent text-zinc-600'
                )}
              >
                <span className={cn('shrink-0', !earned && 'grayscale opacity-60')}>{rung.emoji}</span>
                <span className="truncate">{label} · {unitShort(progress, amount)}</span>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
