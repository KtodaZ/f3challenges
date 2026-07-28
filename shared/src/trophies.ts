// ─── Challenge Trophy Tiers ───────────────────────────────────────────────────
// The end-of-challenge trophy is tiered by how much of the challenge you
// finished: 🥉 Bronze at 50% of the required days, 🥈 Silver at 80%, 🥇 Gold at
// 100%. Anyone who logs at least one day but lands under Bronze still gets the
// 🎖️ Participant trophy — showing up counts.
//
// Because missed days can always be made up through Catch Up, every tier stays
// reachable until the challenge ends. That's what the home-screen nudge leans
// on: there's always a next tier and a concrete number of days to get there.
//
// Legacy badges (awarded before tiers existed) carry no `tier` field. Those are
// resolved by `resolveBadgeTier`: the old 🏆 completion badge reads as Gold and
// the old 🥈 participant badge reads as Silver. Past trophies are never
// downgraded.

import { getRequiredDays } from './challenges'
import type { ChallengeTemplate } from './types'

export type TrophyTier = 'participant' | 'bronze' | 'silver' | 'gold'

export interface TrophyTierDef {
  tier: TrophyTier
  /** Display name — "Bronze", "Gold". */
  label: string
  emoji: string
  /** Share of the challenge's required days needed to earn it (0–1). */
  threshold: number
  /** One-liner for the trophy detail view. */
  blurb: string
}

/** Ascending by threshold — index order matters for tier comparisons. */
export const TROPHY_TIERS: TrophyTierDef[] = [
  {
    tier: 'participant',
    label: 'Participant',
    emoji: '🎖️',
    threshold: 0,
    blurb: 'You logged days and put in work. Showing up is the first win.',
  },
  {
    tier: 'bronze',
    label: 'Bronze',
    emoji: '🥉',
    threshold: 0.5,
    blurb: 'Half the challenge, done. The habit has a foothold.',
  },
  {
    tier: 'silver',
    label: 'Silver',
    emoji: '🥈',
    threshold: 0.8,
    blurb: 'Four out of every five days. Consistency you can count on.',
  },
  {
    tier: 'gold',
    label: 'Gold',
    emoji: '🥇',
    threshold: 1,
    blurb: 'Every required day of the challenge. Nothing left on the table.',
  },
]

export function getTrophyTier(tier: TrophyTier): TrophyTierDef {
  return TROPHY_TIERS.find(t => t.tier === tier) ?? TROPHY_TIERS[0]
}

/** Rank of a tier (0 = participant … 3 = gold). Higher wins. */
export function trophyTierRank(tier: TrophyTier): number {
  return TROPHY_TIERS.findIndex(t => t.tier === tier)
}

/** Days that must be fully completed to reach a tier in this challenge. */
export function tierDaysRequired(challenge: ChallengeTemplate, tier: TrophyTier): number {
  const required = getRequiredDays(challenge)
  const def = getTrophyTier(tier)
  if (def.tier === 'gold') return required
  return Math.max(1, Math.ceil(required * def.threshold))
}

/** Highest tier earned for a completed-day count — null when nothing is logged. */
export function tierForCompletedDays(
  challenge: ChallengeTemplate,
  completedDays: number,
): TrophyTier | null {
  if (completedDays <= 0) return null
  let earned: TrophyTier = 'participant'
  for (const def of TROPHY_TIERS) {
    if (completedDays >= tierDaysRequired(challenge, def.tier)) earned = def.tier
  }
  return earned
}

/** The tier above `tier` — null once Gold is in hand. Pass null for "none yet". */
export function nextTrophyTier(tier: TrophyTier | null): TrophyTierDef | null {
  if (tier === null) return getTrophyTier('bronze')
  const idx = trophyTierRank(tier)
  return TROPHY_TIERS[idx + 1] ?? null
}

export interface TrophyProgress {
  /** Tier the user holds right now, based on completed days. */
  earned: TrophyTierDef | null
  /** Tier they're climbing toward — null once Gold is earned. */
  next: TrophyTierDef | null
  completedDays: number
  requiredDays: number
  /** Days still needed for `next` (0 when Gold). */
  daysToNext: number
  /** Days needed for `next` in total. */
  nextTierDays: number
  /** 0–1 progress across the whole challenge (completed / required). */
  fraction: number
}

export function getTrophyProgress(
  challenge: ChallengeTemplate,
  completedDays: number,
): TrophyProgress {
  const requiredDays = getRequiredDays(challenge)
  const earnedTier = tierForCompletedDays(challenge, completedDays)
  // Participant isn't a target to chase — Bronze is the first real rung.
  const next = earnedTier === 'gold'
    ? null
    : nextTrophyTier(earnedTier === 'participant' ? 'participant' : earnedTier)
  const nextTierDays = next ? tierDaysRequired(challenge, next.tier) : requiredDays
  return {
    earned: earnedTier ? getTrophyTier(earnedTier) : null,
    next,
    completedDays,
    requiredDays,
    daysToNext: next ? Math.max(0, nextTierDays - completedDays) : 0,
    nextTierDays,
    fraction: requiredDays > 0 ? Math.min(1, completedDays / requiredDays) : 0,
  }
}

// ─── Legacy badge resolution ──────────────────────────────────────────────────

/** Anything shaped like a stored challenge badge — app and functions both. */
export interface TrophyBadgeLike {
  type?: string
  tier?: TrophyTier
}

/**
 * Tier for a stored badge. Badges awarded before tiers existed have no `tier`:
 * the old 🏆 completion badge resolves to Gold, and every old participant badge
 * resolves to Silver, so nobody's past trophy shrinks.
 */
export function resolveBadgeTier(badge: TrophyBadgeLike): TrophyTier {
  if (badge.tier && TROPHY_TIERS.some(t => t.tier === badge.tier)) return badge.tier
  return badge.type === 'completed' ? 'gold' : 'silver'
}

/** The legacy `type` to store alongside a tier, so old readers keep working. */
export function legacyBadgeType(tier: TrophyTier): 'completed' | 'participant' {
  return tier === 'gold' ? 'completed' : 'participant'
}

/**
 * The tier a badge should be moved to, or null to leave it alone.
 *
 * Trophies only ever go up. A challenge is never closed off: making up days
 * through Catch Up — including on a challenge that ended months ago — climbs
 * the ladder all the way to 🥇 Gold. And because legacy badges resolve to
 * Silver or Gold, an old trophy can never be knocked down by this.
 */
export function trophyUpgrade(
  current: TrophyBadgeLike | undefined | null,
  earned: TrophyTier | null,
): TrophyTier | null {
  if (earned === null) return null
  if (!current) return earned
  return trophyTierRank(earned) > trophyTierRank(resolveBadgeTier(current)) ? earned : null
}

// ─── Announcement copy ────────────────────────────────────────────────────────

/**
 * Feed post announcing a trophy tier the moment it's claimed — mid-challenge
 * tiers included, so the crew sees every rung, not just the finish.
 */
export function trophyFeedPost(input: {
  userName: string
  challenge: ChallengeTemplate
  tier: TrophyTier
  completedDays: number
}): string {
  const { userName, challenge, tier, completedDays } = input
  const required = getRequiredDays(challenge)
  const handle = `@${userName}`
  switch (tier) {
    case 'gold':
      return `${handle} just completed ${challenge.name} — every single day! 🥇 ${challenge.hashtag}`
    case 'silver':
      return `${handle} just claimed the 🥈 Silver trophy for ${challenge.name} — ${completedDays} of ${required} days in the bank. Gold is still live! ${challenge.hashtag}`
    case 'bronze':
      return `${handle} just locked in the 🥉 Bronze trophy for ${challenge.name} — ${completedDays} days down, halfway home! ${challenge.hashtag}`
    default:
      return `${handle} is on the board for ${challenge.name} 🎖️ ${challenge.hashtag}`
  }
}

/** Push/in-app notification copy for a trophy tier. */
export function trophyNotification(input: {
  challenge: ChallengeTemplate
  tier: TrophyTier
  completedDays: number
}): { title: string; body: string } {
  const { challenge, tier, completedDays } = input
  const def = getTrophyTier(tier)
  const progress = getTrophyProgress(challenge, completedDays)
  const next = progress.next
  const chase = next
    ? ` ${plural(progress.daysToNext, 'more day', 'more days')} gets you ${next.emoji} ${next.label} — keep going.`
    : ' Nothing above this one. Outstanding.'
  return {
    title: `${def.emoji} ${def.label} Trophy Earned!`,
    body: `${completedDays} of ${progress.requiredDays} days of ${challenge.name}.${chase}`,
  }
}

// ─── Home-screen nudge copy ───────────────────────────────────────────────────

export interface TrophyNudgeInput {
  challenge: ChallengeTemplate
  progress: TrophyProgress
  /** Required days already behind the user (today included), for pace. */
  elapsedRequiredDays: number
  /** Past days of this challenge still owed — makeup fuel. */
  missedDays: number
  /** Rotates the phrasing so the same state doesn't read identically forever. */
  seed?: number
}

export interface TrophyNudge {
  /** Short bold line — the state. */
  headline: string
  /** Supporting sentence — the ask. */
  body: string
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

function pick<T>(options: T[], seed = 0): T {
  return options[Math.abs(seed) % options.length]
}

/**
 * The "you're on your way to Bronze" line that sits with Quick Tap. Always
 * names the next tier and exactly how many days it costs; leans on Catch Up
 * when the user has makeup days banked, and on pace when they're on track.
 */
export function trophyNudge(input: TrophyNudgeInput): TrophyNudge {
  const { progress, elapsedRequiredDays, missedDays, seed = 0 } = input
  const { earned, next, completedDays, requiredDays, daysToNext } = progress

  // ── Gold: nothing left to chase ──
  if (!next) {
    return {
      headline: '🥇 Gold trophy locked in',
      body: `All ${requiredDays} days. Every day you add from here is pure interest.`,
    }
  }

  const need = plural(daysToNext, 'more day', 'more days')
  const makeupHint = missedDays > 0
    ? ` ${missedDays === 1 ? 'One missed day is' : `${missedDays} missed days are`} sitting in Catch Up — swipe left to claim ${missedDays === 1 ? 'it' : 'them'}.`
    : ''

  // ── One day from the next tier — the loudest state ──
  if (daysToNext === 1) {
    return {
      headline: `${next.emoji} ${next.label} is one day away`,
      body: `Finish a day and ${next.label} is yours.${makeupHint}`,
    }
  }

  // ── Nothing logged yet ──
  if (completedDays === 0) {
    return {
      headline: `${next.emoji} ${next.label} starts today`,
      body: `${plural(progress.nextTierDays, 'day', 'days')} of this challenge earns the ${next.label} trophy. Day one is the hard one.`,
    }
  }

  // On pace = keeping up with the days that have already gone by.
  const onPace = elapsedRequiredDays > 0 && completedDays >= elapsedRequiredDays

  if (earned === null || earned.tier === 'participant') {
    const headline = pick([
      `${next.emoji} On your way to ${next.label}`,
      `${next.emoji} ${next.label} is in range`,
    ], seed)
    return {
      headline,
      body: onPace
        ? `${completedDays} days banked. Knock out ${need} for ${next.label} — and at this pace 🥇 Gold is still on the table.${makeupHint}`
        : `${completedDays} of ${requiredDays} days in. Knock out ${need} and the ${next.label} trophy is yours.${makeupHint}`,
    }
  }

  const headline = pick([
    `${earned.emoji} ${earned.label} earned — ${next.label} next`,
    `${earned.emoji} ${earned.label} is safe. ${next.emoji} ${next.label} is ${need} out`,
  ], seed)

  return {
    headline,
    body: onPace
      ? `${completedDays} of ${requiredDays} days done and right on pace. Stay consistent — ${need} makes it ${next.label}${next.tier === 'silver' ? ', and Gold is still live' : ''}.${makeupHint}`
      : `${completedDays} of ${requiredDays} days done. ${need} upgrades you to ${next.label}.${makeupHint}`,
  }
}
