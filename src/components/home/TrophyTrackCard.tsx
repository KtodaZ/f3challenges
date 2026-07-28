'use client'

import { getTrophyProgress, trophyNudge } from '@/lib/challenges'
import { TrophyTierBar } from '@/components/ui/TrophyTierBar'
import { TROPHY_TIER_STYLES } from '@/lib/trophyStyles'
import { cn } from '@/lib/utils'
import type { ChallengeTemplate } from '@/types'

interface TrophyTrackCardProps {
  challenge: ChallengeTemplate
  /** Days of this challenge fully completed (makeups included). */
  completedDays: number
  /** Required days that have already passed, today included — for pace. */
  elapsedRequiredDays: number
  /** Past days still owed, available in Catch Up. */
  missedDays: number
  /** Rotates phrasing so the line doesn't read identically every day. */
  seed?: number
}

/**
 * The month's trophy at a glance, right under Quick Tap: which tier you're
 * holding, which one is next, and exactly how many days it costs.
 */
export function TrophyTrackCard({
  challenge,
  completedDays,
  elapsedRequiredDays,
  missedDays,
  seed,
}: TrophyTrackCardProps) {
  const progress = getTrophyProgress(challenge, completedDays)
  const nudge = trophyNudge({ challenge, progress, elapsedRequiredDays, missedDays, seed })

  const accentTier = progress.next?.tier ?? 'gold'
  const style = TROPHY_TIER_STYLES[accentTier]

  return (
    <div
      className={cn(
        'rounded-2xl border p-4 space-y-3',
        progress.earned?.tier === 'gold'
          ? 'bg-gradient-to-b from-amber-950/50 to-zinc-900 border-amber-700/50'
          : 'bg-zinc-900 border-zinc-800'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn('text-sm font-bold leading-tight', style.text)}>{nudge.headline}</p>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{nudge.body}</p>
        </div>
        {progress.earned && (
          <div
            className={cn(
              'shrink-0 flex flex-col items-center justify-center rounded-xl border px-2.5 py-1.5',
              TROPHY_TIER_STYLES[progress.earned.tier].chip
            )}
          >
            <span className="text-lg leading-none">{progress.earned.emoji}</span>
            <span className="text-[9px] font-bold uppercase tracking-wide mt-0.5">
              {progress.earned.label}
            </span>
          </div>
        )}
      </div>

      <TrophyTierBar challenge={challenge} progress={progress} />
    </div>
  )
}
