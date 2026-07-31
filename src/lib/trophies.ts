import {
  isWeeklyCumulative,
  legacyBadgeType,
  resolveBadgeTier,
  sumLogReps,
  tierForAmount,
  trophyTierRank,
  trophyUpgrade,
} from '@/lib/challenges'
import { setBadge } from '@/lib/firestore'
import type { AchievementBadge, ChallengeTemplate, DailyLog, TrophyTier, User } from '@/types'

/**
 * The number the trophy ladder is measured in for this challenge: fully
 * completed days normally, total reps banked on a weekly-cumulative challenge
 * (whole weeks are far too coarse a rung to nudge anyone with).
 *
 * One place so the award, the home nudge, and the feed post can never disagree
 * about what "75% of the challenge" means.
 */
export function trophyAmount(challenge: ChallengeTemplate, logs: DailyLog[]): number {
  const own = logs.filter(l => l.challengeId === challenge.id)
  return isWeeklyCumulative(challenge)
    ? sumLogReps(own)
    : own.filter(l => l.completionFraction >= 1).length
}

export interface TrophyAward {
  /** The tier just earned. */
  tier: TrophyTier
  /** What they held before, if anything — null on a first trophy. */
  from: TrophyTier | null
  badge: AchievementBadge
}

/**
 * Awards or upgrades the challenge trophy after a log is saved, and returns
 * what changed (null when the tier didn't move).
 *
 * Called for the live challenge *and* for ended ones: making up days in Catch
 * Up climbs 🎖️ → 🥉 → 🥈 → 🥇 no matter how long ago the challenge closed.
 * Never downgrades, so old badges are safe.
 */
export async function syncChallengeTrophy(
  user: User,
  challenge: ChallengeTemplate,
  /** Amount banked in the challenge's trophy unit — see trophyAmount(). */
  amount: number,
  /** Tier already awarded this session — the user doc refresh is async, and
   *  rapid quick-taps must not re-fire a tier that just landed. */
  sessionTier?: TrophyTier,
): Promise<TrophyAward | null> {
  const badges = user.badges ?? []
  const existing = badges.find(b => b.challengeId === challenge.id)
  const storedTier = existing ? resolveBadgeTier(existing) : null
  const held = [storedTier, sessionTier ?? null]
    .filter((t): t is TrophyTier => t !== null)
    .sort((a, b) => trophyTierRank(b) - trophyTierRank(a))[0] ?? null

  const earned = tierForAmount(challenge, amount)
  const upgrade = trophyUpgrade(held ? { tier: held } : undefined, earned)
  if (!upgrade) return null

  const badge: AchievementBadge = {
    challengeId: challenge.id,
    type: legacyBadgeType(upgrade),
    tier: upgrade,
    awardedAt: new Date().toISOString(),
  }
  await setBadge(user.id, badge, badges)

  return {
    tier: upgrade,
    from: held,
    badge,
  }
}
