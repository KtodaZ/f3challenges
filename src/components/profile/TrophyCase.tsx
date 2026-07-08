'use client'

import { useState } from 'react'
import { BadgeGrid } from '@/components/profile/BadgeGrid'
import { Modal } from '@/components/ui/Modal'
import { getChallengeById, nearMissLabel } from '@/lib/challenges'
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

type Selected =
  | { kind: 'achievement'; item: AchievementEvaluation }
  | { kind: 'challenge'; badge: AchievementBadge }
  | { kind: 'secret' }
  | null

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

/**
 * The full trophy case: challenge badges up top, then the achievement
 * catalog — earned badges in color, locked ones dimmed with a progress bar,
 * secret ones hidden behind "???" until unlocked. Tap any badge for what
 * it is and how to earn it.
 */
export function TrophyCase({ badges, earned, evaluations }: TrophyCaseProps) {
  const [selected, setSelected] = useState<Selected>(null)

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
        <BadgeGrid badges={badges} onSelect={badge => setSelected({ kind: 'challenge', badge })} />
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

            return (
              <button
                key={e.def.id}
                type="button"
                onClick={() => setSelected({ kind: 'achievement', item: e })}
                className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
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
              </button>
            )
          })}

          {/* Secret achievements stay mysterious until unlocked */}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setSelected({ kind: 'secret' })}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl border bg-zinc-800/40 border-zinc-800 border-dashed">
                <span className="opacity-50">❓</span>
              </div>
              <p className="text-[10px] font-medium text-zinc-600 leading-tight">
                {hiddenCount === 1 ? 'Secret badge' : `${hiddenCount} secret badges`}
              </p>
            </button>
          )}
        </div>
      </div>

      {/* ── Badge detail modal ── */}
      <Modal open={selected !== null} onClose={() => setSelected(null)}>
        {selected?.kind === 'achievement' && (() => {
          const { def, progress } = selected.item
          const unlocked = isEarned(selected.item)
          const when = awardedAt.get(def.id)
          const pct = Math.min(100, Math.round((progress.current / progress.target) * 100))
          return (
            <div className="text-center space-y-4 pb-2">
              <div
                className={cn(
                  'w-24 h-24 mx-auto rounded-3xl flex items-center justify-center text-5xl border',
                  unlocked ? 'bg-amber-900/40 border-amber-700/60' : 'bg-zinc-800/60 border-zinc-800'
                )}
              >
                <span className={cn(!unlocked && 'grayscale opacity-40')}>{def.emoji}</span>
              </div>

              <div>
                <h2 className="text-xl font-black text-white">{def.name}</h2>
                <p className="text-sm text-zinc-400 mt-1">{def.description}</p>
              </div>

              <div className="bg-zinc-800/60 border border-zinc-700/60 rounded-2xl p-4 text-left">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                  How to earn it
                </p>
                <p className="text-sm text-zinc-200">{def.howTo}</p>
              </div>

              {unlocked ? (
                <div className="bg-green-950/40 border border-green-700/40 rounded-2xl px-4 py-3">
                  <p className="text-green-400 font-bold text-sm">
                    ✓ Unlocked{when ? ` — ${fmtDate(when)}` : ''}
                  </p>
                </div>
              ) : (
                <div className="text-left space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs text-zinc-500">
                      Progress: <span className="text-zinc-300 font-semibold">
                        {progress.current.toLocaleString()} / {progress.target.toLocaleString()}
                      </span>
                    </p>
                    <p className="text-xs text-amber-400 font-semibold">
                      {nearMissLabel(selected.item)}
                    </p>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {selected?.kind === 'challenge' && (() => {
          const { badge } = selected
          const challenge = getChallengeById(badge.challengeId)
          const isCompleted = badge.type === 'completed'
          return (
            <div className="text-center space-y-4 pb-2">
              <div
                className={cn(
                  'w-24 h-24 mx-auto rounded-3xl flex items-center justify-center text-5xl border',
                  isCompleted ? 'bg-amber-900/40 border-amber-700/60' : 'bg-zinc-800 border-zinc-700'
                )}
              >
                {isCompleted ? '🏆' : '🥈'}
              </div>

              <div>
                <h2 className="text-xl font-black text-white">
                  {isCompleted ? 'Challenge Complete' : 'Participant'}
                </h2>
                <p className="text-sm text-orange-400 font-semibold mt-1">
                  {challenge?.name ?? badge.challengeId}
                </p>
                {challenge && <p className="text-xs text-zinc-500">{challenge.hashtag}</p>}
              </div>

              <div className="bg-zinc-800/60 border border-zinc-700/60 rounded-2xl p-4 text-left">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                  How to earn it
                </p>
                <p className="text-sm text-zinc-200">
                  {isCompleted
                    ? 'Complete every required day of the challenge — makeups count, so Catch Up can still get you here.'
                    : 'Log at least one day of the challenge. Make up the missed days to upgrade this to the 🏆 Completion badge.'}
                </p>
              </div>

              <div className="bg-green-950/40 border border-green-700/40 rounded-2xl px-4 py-3">
                <p className="text-green-400 font-bold text-sm">
                  ✓ Earned — {fmtDate(badge.awardedAt)}
                </p>
              </div>
            </div>
          )
        })()}

        {selected?.kind === 'secret' && (
          <div className="text-center space-y-4 pb-2">
            <div className="w-24 h-24 mx-auto rounded-3xl flex items-center justify-center text-5xl border border-dashed bg-zinc-800/40 border-zinc-700">
              <span className="opacity-60">❓</span>
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Secret Badge</h2>
              <p className="text-sm text-zinc-400 mt-1">
                Some badges only reveal themselves when you earn them.
              </p>
            </div>
            <div className="bg-zinc-800/60 border border-zinc-700/60 rounded-2xl p-4">
              <p className="text-sm text-zinc-300">
                Keep showing up — grind at odd hours, go above and beyond, and you might stumble into it. 👀
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
