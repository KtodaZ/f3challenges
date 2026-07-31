// ─── Challenge Trophy Tiers ───────────────────────────────────────────────────
// The end-of-challenge trophy is tiered by how much of the challenge you
// finished: 🥉 Bronze at 50%, 🥈 Silver at 75%, 🥇 Gold at 100%. Anyone who
// logs anything but lands under Bronze still gets the 🎖️ Participant trophy —
// showing up counts.
//
// What's being counted depends on the challenge (see TrophyUnit):
//   • day-based challenges score in fully completed days
//   • weekly-cumulative challenges score in reps banked across the month,
//     because whole weeks are far too coarse to nudge anyone — a 6-week
//     challenge would jump Bronze → Silver → Gold three days at a time.
//
// Because missed work can always be made up through Catch Up, every tier stays
// reachable until the challenge ends. That's what the home-screen nudge leans
// on: there's always a next tier and a concrete number to get there.
//
// Legacy badges (awarded before tiers existed) carry no `tier` field. Those are
// resolved by `resolveBadgeTier`: the old 🏆 completion badge reads as Gold and
// the old 🥈 participant badge reads as Silver. Past trophies are never
// downgraded.

import { getChallengeRepTotal, getRequiredDays } from './challenges'
import type { ChallengeTemplate } from './types'

export type TrophyTier = 'participant' | 'bronze' | 'silver' | 'gold'

export interface TrophyTierDef {
  tier: TrophyTier
  /** Display name — "Bronze", "Gold". */
  label: string
  emoji: string
  /** Optional artwork for this tier on this challenge — see
   *  ChallengeTemplate.trophyStyle.iconUrl. `emoji` is always the fallback. */
  iconUrl?: string
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
    threshold: 0.75,
    blurb: 'Three-quarters of the challenge. Consistency you can count on.',
  },
  {
    tier: 'gold',
    label: 'Gold',
    emoji: '🥇',
    threshold: 1,
    blurb: 'The whole challenge. Nothing left on the table.',
  },
]

// ─── Scoring unit ─────────────────────────────────────────────────────────────
// Trophies used to count one thing: fully completed days. Weekly-cumulative
// challenges don't have those, so the ladder is measured in whatever unit the
// challenge actually scores. Adding a future unit means one more case here plus
// its noun — nothing downstream changes.

export type TrophyUnit = 'day' | 'rep'

export interface TrophyUnitInfo {
  unit: TrophyUnit
  /** Amount needed for 🥇 Gold. */
  required: number
  /** Nouns for copy: "3 days", "1 rep". */
  one: string
  many: string
}

export function getTrophyUnit(challenge: ChallengeTemplate): TrophyUnitInfo {
  if (challenge.type === 'weekly-cumulative') {
    return { unit: 'rep', required: getChallengeRepTotal(challenge), one: 'rep', many: 'reps' }
  }
  return { unit: 'day', required: getRequiredDays(challenge), one: 'day', many: 'days' }
}

/**
 * A tier as this challenge dresses it. Themed months (August's Bedrock Bicep)
 * re-skin the emoji and label via ChallengeTemplate.trophyStyle; everything
 * else — thresholds, ordering, upgrade rules — is untouched, so a re-skin can
 * never change who earned what.
 */
export function getTrophyTier(tier: TrophyTier, challenge?: ChallengeTemplate): TrophyTierDef {
  const base = TROPHY_TIERS.find(t => t.tier === tier) ?? TROPHY_TIERS[0]
  const style = challenge?.trophyStyle
  if (!style) return base
  return {
    ...base,
    emoji: style.emoji?.[base.tier] ?? base.emoji,
    label: style.label?.[base.tier] ?? base.label,
    iconUrl: style.iconUrl?.[base.tier],
  }
}

/** The full ladder, themed for this challenge. */
export function getTrophyTiers(challenge?: ChallengeTemplate): TrophyTierDef[] {
  return TROPHY_TIERS.map(t => getTrophyTier(t.tier, challenge))
}

/** Rank of a tier (0 = participant … 3 = gold). Higher wins. */
export function trophyTierRank(tier: TrophyTier): number {
  return TROPHY_TIERS.findIndex(t => t.tier === tier)
}

/** Amount (days or reps, per the challenge) needed to reach a tier. */
export function tierAmountRequired(challenge: ChallengeTemplate, tier: TrophyTier): number {
  const { required } = getTrophyUnit(challenge)
  const def = getTrophyTier(tier)
  if (def.tier === 'gold') return required
  return Math.max(1, Math.ceil(required * def.threshold))
}

/** Highest tier earned for an amount — null when nothing is logged. */
export function tierForAmount(
  challenge: ChallengeTemplate,
  amount: number,
): TrophyTier | null {
  if (amount <= 0) return null
  let earned: TrophyTier = 'participant'
  for (const def of TROPHY_TIERS) {
    if (amount >= tierAmountRequired(challenge, def.tier)) earned = def.tier
  }
  return earned
}

/** @deprecated Day-based alias kept for callers that only ever count days. */
export const tierDaysRequired = tierAmountRequired
/** @deprecated Use tierForAmount — the amount is days only on day-based challenges. */
export const tierForCompletedDays = tierForAmount

/** The tier above `tier` — null once Gold is in hand. Pass null for "none yet". */
export function nextTrophyTier(tier: TrophyTier | null): TrophyTierDef | null {
  if (tier === null) return getTrophyTier('bronze')
  const idx = trophyTierRank(tier)
  return TROPHY_TIERS[idx + 1] ?? null
}

export interface TrophyProgress {
  /** Tier the user holds right now. */
  earned: TrophyTierDef | null
  /** Tier they're climbing toward — null once Gold is earned. */
  next: TrophyTierDef | null
  /** What's being counted, and its nouns for copy. */
  unit: TrophyUnitInfo
  /** Amount banked, in `unit`. */
  completed: number
  /** Amount needed for Gold, in `unit`. */
  required: number
  /** Still needed for `next` (0 when Gold). */
  toNext: number
  /** Total needed for `next`. */
  nextTierAmount: number
  /** 0–1 progress across the whole challenge (completed / required). */
  fraction: number
}

export function getTrophyProgress(
  challenge: ChallengeTemplate,
  completed: number,
): TrophyProgress {
  const unit = getTrophyUnit(challenge)
  const required = unit.required
  const earnedTier = tierForAmount(challenge, completed)
  // Participant isn't a target to chase — Bronze is the first real rung.
  const nextBase = earnedTier === 'gold'
    ? null
    : nextTrophyTier(earnedTier === 'participant' ? 'participant' : earnedTier)
  // Both rungs come back wearing this challenge's theme.
  const next = nextBase ? getTrophyTier(nextBase.tier, challenge) : null
  const nextTierAmount = next ? tierAmountRequired(challenge, next.tier) : required
  return {
    earned: earnedTier ? getTrophyTier(earnedTier, challenge) : null,
    next,
    unit,
    completed,
    required,
    toNext: next ? Math.max(0, nextTierAmount - completed) : 0,
    nextTierAmount,
    fraction: required > 0 ? Math.min(1, completed / required) : 0,
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
  /** Amount banked, in the challenge's trophy unit (days or reps). */
  completed: number
}): string {
  const { userName, challenge, tier, completed } = input
  const { required, many } = getTrophyUnit(challenge)
  const handle = `@${userName}`
  const def = getTrophyTier(tier, challenge)
  const gold = getTrophyTier('gold', challenge)
  const goldLine = many === 'reps' ? 'every rep of it' : 'every single day'
  switch (tier) {
    case 'gold':
      return `${handle} just completed ${challenge.name} — ${goldLine}! ${def.emoji} ${challenge.hashtag}`
    case 'silver':
      return `${handle} just claimed ${def.emoji} ${def.label} for ${challenge.name} — ${completed.toLocaleString()} of ${required.toLocaleString()} ${many} in the bank. ${gold.label} is still live! ${challenge.hashtag}`
    case 'bronze':
      return `${handle} just locked in ${def.emoji} ${def.label} for ${challenge.name} — ${completed.toLocaleString()} ${many} down, halfway home! ${challenge.hashtag}`
    default:
      return `${handle} is on the board for ${challenge.name} ${def.emoji} ${challenge.hashtag}`
  }
}

/** Push/in-app notification copy for a trophy tier. */
export function trophyNotification(input: {
  challenge: ChallengeTemplate
  tier: TrophyTier
  /** Amount banked, in the challenge's trophy unit. */
  completed: number
}): { title: string; body: string } {
  const { challenge, tier, completed } = input
  const def = getTrophyTier(tier, challenge)
  const progress = getTrophyProgress(challenge, completed)
  const next = progress.next
  const chase = next
    ? ` ${plural(progress.toNext, `more ${progress.unit.one}`, `more ${progress.unit.many}`)} gets you ${next.emoji} ${next.label} — keep going.`
    : ' Nothing above this one. Outstanding.'
  return {
    title: `${def.emoji} ${def.label} Trophy Earned!`,
    body: `${completed.toLocaleString()} of ${progress.required.toLocaleString()} ${progress.unit.many} of ${challenge.name}.${chase}`,
  }
}

// ─── Home-screen nudge copy ───────────────────────────────────────────────────

export interface TrophyNudgeInput {
  challenge: ChallengeTemplate
  progress: TrophyProgress
  /** How much of the challenge is already behind the user, in the trophy's
   *  unit — elapsed required days, or the reps the weeks so far asked for.
   *  Banking at least this much means "on pace". */
  elapsedRequiredDays: number
  /** Past days of this challenge still owed — makeup fuel. 0 when the
   *  challenge has no per-day obligation. */
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
  const { earned, next, completed, required, toNext, unit } = progress
  const n = (v: number) => v.toLocaleString()

  // ── Gold: nothing left to chase ──
  if (!next) {
    const gold = getTrophyTier('gold', input.challenge)
    return {
      headline: `${gold.emoji} ${gold.label} locked in`,
      body: unit.unit === 'rep'
        ? `All ${n(required)} reps. Everything you add from here is pure interest.`
        : `All ${required} days. Every day you add from here is pure interest.`,
    }
  }

  const need = plural(toNext, `more ${unit.one}`, `more ${unit.many}`)
  const makeupHint = missedDays > 0
    ? ` ${missedDays === 1 ? 'One missed day is' : `${missedDays} missed days are`} sitting in Catch Up — swipe left to claim ${missedDays === 1 ? 'it' : 'them'}.`
    : ''

  // ── One unit from the next tier — the loudest state ──
  if (toNext === 1) {
    return {
      headline: `${next.emoji} ${next.label} is one ${unit.one} away`,
      body: `One more ${unit.one} and ${next.label} is yours.${makeupHint}`,
    }
  }

  // ── Nothing logged yet ──
  if (completed === 0) {
    return {
      headline: `${next.emoji} ${next.label} starts today`,
      body: unit.unit === 'rep'
        ? `${n(progress.nextTierAmount)} reps earns the ${next.label} trophy. The first set is the hard one.`
        : `${plural(progress.nextTierAmount, 'day', 'days')} of this challenge earns the ${next.label} trophy. Day one is the hard one.`,
    }
  }

  // On pace = keeping up with what the challenge has asked for so far.
  const onPace = elapsedRequiredDays > 0 && completed >= elapsedRequiredDays

  if (earned === null || earned.tier === 'participant') {
    const headline = pick([
      `${next.emoji} On your way to ${next.label}`,
      `${next.emoji} ${next.label} is in range`,
    ], seed)
    return {
      headline,
      body: onPace
        ? `${n(completed)} ${unit.many} banked. ${sentence(need)} for ${next.label} — and at this pace ${goldOf(input)} is still on the table.${makeupHint}`
        : `${n(completed)} of ${n(required)} ${unit.many} in. ${sentence(need)} and the ${next.label} trophy is yours.${makeupHint}`,
    }
  }

  const headline = pick([
    `${earned.emoji} ${earned.label} earned — ${next.label} next`,
    `${earned.emoji} ${earned.label} is safe. ${next.emoji} ${next.label} is ${need} out`,
  ], seed)

  return {
    headline,
    body: onPace
      ? `${n(completed)} of ${n(required)} ${unit.many} done and right on pace. Stay consistent — ${need} makes it ${next.label}${next.tier === 'silver' ? `, and ${goldOf(input)} is still live` : ''}.${makeupHint}`
      : `${n(completed)} of ${n(required)} ${unit.many} done. ${need} upgrades you to ${next.label}.${makeupHint}`,
  }
}

/** "🥇 Gold" as this challenge dresses it, for chase copy. */
function goldOf(input: TrophyNudgeInput): string {
  const gold = getTrophyTier('gold', input.challenge)
  return `${gold.emoji} ${gold.label}`
}

/** "3 more days" → "Knock out 3 more days"; reps read better as "Bank …". */
function sentence(need: string): string {
  return need.endsWith('reps') || need.endsWith('rep') ? `Bank ${need}` : `Knock out ${need}`
}
