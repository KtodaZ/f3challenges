'use client'

import { Modal } from '@/components/ui/Modal'
import {
  getChallengeById,
  getRequiredDays,
  getTrophyTier,
  nearMissLabel,
  nextTrophyTier,
  resolveBadgeTier,
  tierDaysRequired,
} from '@/lib/challenges'
import { TROPHY_TIER_STYLES } from '@/lib/trophyStyles'
import { cn } from '@/lib/utils'
import type { AchievementBadge, AchievementEvaluation } from '@/types'

export type BadgeDetail =
  | { kind: 'achievement'; item: AchievementEvaluation; earned: boolean; earnedAt?: string }
  | { kind: 'challenge'; badge: AchievementBadge }
  | { kind: 'secret' }

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

/** What a badge is, how to earn it, and progress — used by the trophy case
 *  and the home Next Badge card. */
export function BadgeDetailModal({ detail, onClose }: { detail: BadgeDetail | null; onClose: () => void }) {
  return (
    <Modal open={detail !== null} onClose={onClose}>
      {detail?.kind === 'achievement' && (() => {
        const { def, progress } = detail.item
        const { earned, earnedAt } = detail
        const pct = Math.min(100, Math.round((progress.current / progress.target) * 100))
        return (
          <div className="text-center space-y-4 pb-2">
            <div
              className={cn(
                'w-24 h-24 mx-auto rounded-3xl flex items-center justify-center text-5xl border',
                earned ? 'bg-amber-900/40 border-amber-700/60' : 'bg-zinc-800/60 border-zinc-800'
              )}
            >
              <span className={cn(!earned && 'grayscale opacity-40')}>{def.emoji}</span>
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

            {earned ? (
              <div className="bg-green-950/40 border border-green-700/40 rounded-2xl px-4 py-3">
                <p className="text-green-400 font-bold text-sm">
                  ✓ Unlocked{earnedAt ? ` — ${fmtDate(earnedAt)}` : ''}
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
                    {nearMissLabel(detail.item)}
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

      {detail?.kind === 'challenge' && (() => {
        const { badge } = detail
        const challenge = getChallengeById(badge.challengeId)
        const tier = getTrophyTier(resolveBadgeTier(badge))
        const next = nextTrophyTier(tier.tier)
        return (
          <div className="text-center space-y-4 pb-2">
            <div
              className={cn(
                'w-24 h-24 mx-auto rounded-3xl flex items-center justify-center text-5xl border',
                TROPHY_TIER_STYLES[tier.tier].tile
              )}
            >
              {tier.emoji}
            </div>

            <div>
              <h2 className="text-xl font-black text-white">{tier.label} Trophy</h2>
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
                {tier.tier === 'gold'
                  ? 'Complete every required day of the challenge — makeups count, so Catch Up can still get you here.'
                  : `${tier.blurb} ${challenge ? `That's ${tierDaysRequired(challenge, tier.tier)} of ${getRequiredDays(challenge)} days.` : ''}`}
              </p>
            </div>

            {next && challenge && (
              <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-2xl p-4 text-left">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                  Next tier
                </p>
                <p className="text-sm text-zinc-200">
                  {next.emoji} {next.label} at {tierDaysRequired(challenge, next.tier)} days. Missed
                  days never expire — make them up in Catch Up and this trophy upgrades.
                </p>
              </div>
            )}

            <div className="bg-green-950/40 border border-green-700/40 rounded-2xl px-4 py-3">
              <p className="text-green-400 font-bold text-sm">
                ✓ Earned — {fmtDate(badge.awardedAt)}
              </p>
            </div>
          </div>
        )
      })()}

      {detail?.kind === 'secret' && (
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
  )
}
