import {
  legacyBadgeType,
  resolveBadgeTier,
  tierForCompletedDays,
  trophyTierRank,
  trophyUpgrade,
} from '@/lib/challenges'
import { setBadge } from '@/lib/firestore'
import type { AchievementBadge, ChallengeTemplate, TrophyTier, User } from '@/types'

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
  completedDays: number,
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

  const earned = tierForCompletedDays(challenge, completedDays)
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
