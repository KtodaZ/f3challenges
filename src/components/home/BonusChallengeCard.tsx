import type { BonusChallengeWeek, BonusChallenge } from '@/types'

interface BonusChallengeCardProps {
  bonus: BonusChallenge
  activeWeek: BonusChallengeWeek
}

export function BonusChallengeCard({ bonus, activeWeek }: BonusChallengeCardProps) {
  return (
    <div className="rounded-2xl bg-blue-950/30 border border-blue-700/40 px-4 py-3 flex items-start gap-3">
      <span className="text-blue-400 mt-0.5 text-lg shrink-0">🏃</span>
      <div className="flex-1 min-w-0">
        <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">
          Bonus — {bonus.name}
        </p>
        <p className="text-white text-sm font-medium mt-0.5">{activeWeek.description}</p>
      </div>
    </div>
  )
}
