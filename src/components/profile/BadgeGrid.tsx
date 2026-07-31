'use client'

import { getChallengeById, getTrophyTier, resolveBadgeTier } from '@/lib/challenges'
import { TROPHY_TIER_STYLES } from '@/lib/trophyStyles'
import { cn } from '@/lib/utils'
import type { AchievementBadge } from '@/types'

interface BadgeGridProps {
  badges: AchievementBadge[]
  /** When provided, badges become tappable (detail modal in TrophyCase). */
  onSelect?: (badge: AchievementBadge) => void
}

function badgeLabel(badge: AchievementBadge): string {
  const challenge = getChallengeById(badge.challengeId)
  if (!challenge) return badge.challengeId
  const date = new Date(badge.awardedAt)
  const monthYear = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  const tier = getTrophyTier(resolveBadgeTier(badge), challenge)
  return `${monthYear} — ${challenge.name} — ${tier.label}`
}

function challengeMonthYear(badge: AchievementBadge): string {
  const challenge = getChallengeById(badge.challengeId)
  if (!challenge) return ''
  return new Date(`${challenge.year}-${String(challenge.month).padStart(2, '0')}-01`).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

export function BadgeGrid({ badges, onSelect }: BadgeGridProps) {
  if (badges.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500 text-sm">
        No badges yet — complete a challenge to earn one!
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {badges.map((badge) => {
        const challenge = getChallengeById(badge.challengeId)
        const tier = getTrophyTier(resolveBadgeTier(badge), challenge)
        const label = badgeLabel(badge)
        const monthYear = challengeMonthYear(badge)

        return (
          <button
            key={badge.challengeId}
            type="button"
            onClick={onSelect ? () => onSelect(badge) : undefined}
            className={`flex flex-col items-center gap-1.5 group relative ${onSelect ? 'cursor-pointer active:scale-95 transition-transform' : 'cursor-default'}`}
            title={label}
          >
            <div
              className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center text-3xl',
                'border transition-transform group-hover:scale-105',
                TROPHY_TIER_STYLES[tier.tier].tile
              )}
            >
              {tier.emoji}
            </div>
            <div className="text-center">
              <p className={cn('text-[10px] font-semibold leading-tight', TROPHY_TIER_STYLES[tier.tier].text)}>
                {tier.label}
              </p>
              <p className="text-[9px] text-zinc-500 leading-tight">
                {monthYear}
              </p>
              <p className="text-[9px] text-zinc-600 leading-tight truncate max-w-[72px]">
                {challenge?.name ?? badge.challengeId}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
