'use client'

import { getChallengeById } from '@/lib/challenges'
import type { AchievementBadge } from '@/types'

interface BadgeGridProps {
  badges: AchievementBadge[]
}

function badgeLabel(badge: AchievementBadge): string {
  const challenge = getChallengeById(badge.challengeId)
  if (!challenge) return badge.challengeId
  const date = new Date(badge.awardedAt)
  const monthYear = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  const typeLabel = badge.type === 'completed' ? 'Completed' : 'Participated'
  return `${monthYear} — ${challenge.name} — ${typeLabel}`
}

function challengeMonthYear(badge: AchievementBadge): string {
  const challenge = getChallengeById(badge.challengeId)
  if (!challenge) return ''
  return new Date(`${challenge.year}-${String(challenge.month).padStart(2, '0')}-01`).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

export function BadgeGrid({ badges }: BadgeGridProps) {
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
        const isCompleted = badge.type === 'completed'
        const label = badgeLabel(badge)
        const monthYear = challengeMonthYear(badge)

        return (
          <div
            key={`${badge.challengeId}-${badge.type}`}
            className="flex flex-col items-center gap-1.5 group relative"
            title={label}
          >
            <div
              className={`
                w-16 h-16 rounded-2xl flex items-center justify-center text-3xl
                border transition-transform group-hover:scale-105
                ${isCompleted
                  ? 'bg-amber-900/40 border-amber-700/60'
                  : 'bg-zinc-800 border-zinc-700'
                }
              `}
            >
              {isCompleted ? '🏆' : '🥈'}
            </div>
            <div className="text-center">
              <p className="text-[10px] font-medium text-zinc-400 leading-tight">
                {monthYear}
              </p>
              <p className="text-[9px] text-zinc-600 leading-tight truncate max-w-[72px]">
                {challenge?.name ?? badge.challengeId}
              </p>
            </div>
            {/* Tooltip */}
            <div className="
              absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10
              bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5
              text-xs text-white whitespace-nowrap
              opacity-0 group-hover:opacity-100 pointer-events-none
              transition-opacity shadow-xl
            ">
              {label}
            </div>
          </div>
        )
      })}
    </div>
  )
}
