'use client'

import { BadgeGrid } from '@/components/profile/BadgeGrid'
import { cn } from '@/lib/utils'
import type {
  AchievementBadge,
  AchievementEvaluation,
  EarnedAchievement,
} from '@/types'

interface TrophyCaseProps {
  /** Per-challenge badges (🏆 completed / 🥈 participant). */
  badges: AchievementBadge[]
  /** Persisted achievement awards. */
  earned: EarnedAchievement[]
  /** Full catalog evaluation for this user (earned + progress on locked). */
  evaluations: AchievementEvaluation[]
}

/**
 * The full trophy case: challenge badges up top, then the achievement
 * catalog — earned badges in color, locked ones dimmed with a progress bar,
 * secret ones hidden behind "???" until unlocked.
 */
export function TrophyCase({ badges, earned, evaluations }: TrophyCaseProps) {
  const earnedIds = new Set(earned.map(a => a.id))
  const awardedAt = new Map(earned.map(a => [a.id, a.awardedAt]))

  const isEarned = (e: AchievementEvaluation) =>
    earnedIds.has(e.def.id) || e.progress.earned

  const visible = evaluations.filter(e => isEarned(e) || !e.def.secret)
  const hiddenCount = evaluations.length - visible.length
  const earnedCount = evaluations.filter(isEarned).length

  return (
    <div className="space-y-5">
      {/* ── Challenge badges ── */}
      <div>
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Challenge Badges
        </p>
        <BadgeGrid badges={badges} />
      </div>

      {/* ── Achievements ── */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Achievements
          </p>
          <p className="text-xs text-zinc-500">
            {earnedCount} / {evaluations.length}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {visible.map(e => {
            const unlocked = isEarned(e)
            const pct = Math.min(100, Math.round((e.progress.current / e.progress.target) * 100))
            const when = awardedAt.get(e.def.id)

            return (
              <div
                key={e.def.id}
                className="flex flex-col items-center gap-1.5"
                title={
                  unlocked
                    ? `${e.def.name} — ${e.def.description}${when ? ` (earned ${new Date(when).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` : ''}`
                    : `${e.def.name} — ${e.def.description} (${e.progress.current.toLocaleString()}/${e.progress.target.toLocaleString()})`
                }
              >
                <div
                  className={cn(
                    'w-16 h-16 rounded-2xl flex items-center justify-center text-3xl border transition-transform hover:scale-105',
                    unlocked
                      ? 'bg-amber-900/40 border-amber-700/60'
                      : 'bg-zinc-800/60 border-zinc-800'
                  )}
                >
                  <span className={cn(!unlocked && 'grayscale opacity-40')}>{e.def.emoji}</span>
                </div>
                <div className="text-center w-full">
                  <p className={cn(
                    'text-[10px] font-medium leading-tight truncate',
                    unlocked ? 'text-amber-300' : 'text-zinc-500'
                  )}>
                    {e.def.name}
                  </p>
                  {unlocked ? (
                    <p className="text-[9px] text-zinc-600 leading-tight">Unlocked</p>
                  ) : (
                    <div className="h-1 bg-zinc-800 rounded-full mt-1 mx-1 overflow-hidden">
                      <div
                        className="h-full bg-amber-600/70 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Secret achievements stay mysterious until unlocked */}
          {hiddenCount > 0 && (
            <div className="flex flex-col items-center gap-1.5" title="Secret achievement — keep grinding to find it">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl border bg-zinc-800/40 border-zinc-800 border-dashed">
                <span className="opacity-50">❓</span>
              </div>
              <p className="text-[10px] font-medium text-zinc-600 leading-tight">
                {hiddenCount === 1 ? 'Secret badge' : `${hiddenCount} secret badges`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
