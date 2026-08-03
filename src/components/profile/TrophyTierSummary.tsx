'use client'

import { getTrophyProgress } from '@/lib/challenges'
import { TrophyTierBar } from '@/components/ui/TrophyTierBar'
import { TROPHY_TIER_STYLES } from '@/lib/trophyStyles'
import { cn } from '@/lib/utils'
import type { ChallengeTemplate } from '@/types'

interface TrophyTierSummaryProps {
  challenge: ChallengeTemplate
  /** Amount banked in the challenge's trophy unit — completed days normally,
   *  reps on a weekly-cumulative month. Always from trophyAmount(); passing a
   *  day count on a rep-scored challenge reads as barely started. */
  completed: number
}

/**
 * Where this month's trophy stands — the tier in hand and what's left to the
 * next one. Reads the same on your own profile and on someone else's.
 */
export function TrophyTierSummary({ challenge, completed }: TrophyTierSummaryProps) {
  const progress = getTrophyProgress(challenge, completed)
  const { earned, next, toNext, unit } = progress

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center justify-between gap-2">
        {earned ? (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold',
              TROPHY_TIER_STYLES[earned.tier].chip
            )}
          >
            <span>{earned.emoji}</span>
            {earned.label} trophy
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-zinc-700 bg-zinc-800/60 text-zinc-400 text-xs font-semibold">
            🔒 No trophy yet
          </span>
        )}

        {next && (
          <span className="text-xs text-zinc-400 text-right">
            <span className="font-semibold text-zinc-200">
              {toNext.toLocaleString()} {toNext === 1 ? unit.one : unit.many}
            </span>
            {' to '}
            {next.emoji} {next.label}
          </span>
        )}
      </div>

      <TrophyTierBar challenge={challenge} progress={progress} />
    </div>
  )
}
