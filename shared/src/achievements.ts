// ─── Achievement Definitions ──────────────────────────────────────────────────
// Single source of truth for gamification achievements ("trophy case" badges).
//
// These are distinct from the per-challenge AchievementBadge (🏆 completed /
// 🥈 participant) awarded at challenge completion — achievements are earned
// across challenges from behavior: streaks, volume, comebacks, timing, social.
//
// Every achievement exposes a progress() function over an AchievementContext,
// which powers both awarding AND the "you're 1 makeup day away from Phoenix"
// near-miss advertising on the home screen.

import { CHALLENGES, getRequiredDays } from './challenges'

// ─── Inputs ───────────────────────────────────────────────────────────────────

/** Minimal per-day log shape the engine needs — map your DailyLog into this. */
export interface AchievementLogInput {
  date: string           // YYYY-MM-DD
  challengeId: string
  completionFraction: number
  isMakeUp: boolean
  loggedAt?: string      // ISO timestamp of when it was logged
  completedReps: number  // sum of completedReps across exercises
  targetReps: number     // sum of targetReps across exercises
}

export interface AchievementContext {
  /** All of the user's logs, across every challenge. */
  logs: AchievementLogInput[]
  longestStreak: number
  /** Shoutouts this user has posted / received (feed). Omit if unknown. */
  shoutoutsGiven?: number
  shoutoutsReceived?: number
  /** Bonus-challenge weeks completed vs total, across challenges with a bonus. */
  bonusWeeks?: { completed: number; total: number }
  /** Days where this user was the first PAX to fully complete the challenge. */
  firstFinisherDays?: number
}

/** Earned achievement as persisted on the user document. */
export interface EarnedAchievement {
  id: string
  awardedAt: string // ISO
}

// ─── Definitions ──────────────────────────────────────────────────────────────

export type AchievementCategory =
  | 'streak'
  | 'volume'
  | 'comeback'
  | 'timing'
  | 'social'
  | 'special'

export type CelebrationTheme = 'confetti' | 'gold' | 'embers' | 'fireworks'

export interface AchievementProgress {
  current: number
  target: number
  earned: boolean
}

export interface AchievementDefinition {
  id: string
  name: string
  emoji: string
  /** Short flavor line shown on the badge and in unlock feed posts. */
  description: string
  /** Plain instruction for the badge detail view: exactly how to earn it. */
  howTo: string
  category: AchievementCategory
  /** Unit for near-miss copy: "2 {unitLabel} away from …" */
  unitLabel: string
  /** Chain key + tier for tiered ladders (only advertise the next tier). */
  chain?: string
  tier?: number
  /** Hidden until earned — a surprise unlock. */
  secret?: boolean
  /** Particle theme for the unlock celebration. */
  theme: CelebrationTheme
  progress: (ctx: AchievementContext) => AchievementProgress
}

// ─── Shared computation helpers ───────────────────────────────────────────────

function completeLogs(ctx: AchievementContext): AchievementLogInput[] {
  return ctx.logs.filter(l => l.completionFraction >= 1)
}

function totalReps(ctx: AchievementContext): number {
  return ctx.logs.reduce((sum, l) => sum + l.completedReps, 0)
}

function countProgress(current: number, target: number): AchievementProgress {
  return { current: Math.min(current, target), target, earned: current >= target }
}

/** Hour of day (0–23) in PT for an ISO timestamp; null if missing/invalid. */
function loggedHourPT(iso?: string): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return parseInt(
    d.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false }),
    10
  ) % 24
}

function isWeekend(date: string): boolean {
  const day = new Date(date + 'T12:00:00Z').getUTCDay()
  return day === 0 || day === 6
}

interface PerChallengeStats {
  challengeId: string
  requiredDays: number
  completedDays: number
  onTimeDays: number   // completed, not a makeup
  makeupDays: number   // completed via makeup
}

function perChallengeStats(ctx: AchievementContext): PerChallengeStats[] {
  return CHALLENGES.map(c => {
    const logs = ctx.logs.filter(l => l.challengeId === c.id && l.completionFraction >= 1)
    const makeupDays = logs.filter(l => l.isMakeUp).length
    return {
      challengeId: c.id,
      requiredDays: getRequiredDays(c),
      completedDays: logs.length,
      onTimeDays: logs.length - makeupDays,
      makeupDays,
    }
  }).filter(s => s.completedDays > 0)
}

/** The per-challenge stat row closest to (or past) a goal, by completion ratio. */
function bestChallenge(
  stats: PerChallengeStats[],
  value: (s: PerChallengeStats) => number,
): PerChallengeStats | undefined {
  return [...stats].sort(
    (a, b) => value(b) / b.requiredDays - value(a) / a.requiredDays
  )[0]
}

function streakAchievement(id: string, name: string, emoji: string, description: string, days: number, tier: number, theme: CelebrationTheme = 'gold'): AchievementDefinition {
  return {
    id, name, emoji, description,
    howTo: `Complete the challenge ${days} days in a row. Rest days don't break the streak.`,
    category: 'streak', unitLabel: 'days', chain: 'streak', tier, theme,
    progress: ctx => countProgress(ctx.longestStreak, days),
  }
}

function volumeAchievement(id: string, name: string, emoji: string, description: string, reps: number, tier: number, theme: CelebrationTheme = 'gold'): AchievementDefinition {
  return {
    id, name, emoji, description,
    howTo: `Log ${reps.toLocaleString()} total reps, counted across every challenge — partial days count too.`,
    category: 'volume', unitLabel: 'reps', chain: 'volume', tier, theme,
    progress: ctx => countProgress(totalReps(ctx), reps),
  }
}

// ─── The catalog ──────────────────────────────────────────────────────────────

export const ACHIEVEMENTS: AchievementDefinition[] = [
  // ── Streak ladder 🔥 ──
  streakAchievement('kindling', 'Kindling', '🔥', '3-day streak — the fire is lit.', 3, 1),
  streakAchievement('week-of-fire', 'Week of Fire', '🔥', '7 straight days. A full week, no misses.', 7, 2),
  streakAchievement('fortnight-force', 'Fortnight Force', '⚡', '14-day streak. Two weeks of showing up.', 14, 3),
  streakAchievement('unbreakable', 'Unbreakable', '🛡️', '21-day streak. Habits are forged now.', 21, 4, 'fireworks'),
  streakAchievement('eternal-flame', 'Eternal Flame', '🌋', '45-day streak — across challenge boundaries.', 45, 5, 'fireworks'),

  // ── Volume ladder 💪 ──
  volumeAchievement('first-thousand', 'First Thousand', '💯', '1,000 total reps logged.', 1_000, 1),
  volumeAchievement('club-5k', '5K Club', '🏋️', '5,000 total reps. Putting in real work.', 5_000, 2),
  volumeAchievement('silverback', 'Silverback', '🦍', '10,000 total reps. Respect.', 10_000, 3),
  volumeAchievement('rep-royalty', 'Rep Royalty', '👑', '25,000 total reps. Bow down.', 25_000, 4, 'fireworks'),
  volumeAchievement('immortal', 'Immortal', '🗿', '50,000 total reps. Carved from stone.', 50_000, 5, 'fireworks'),

  // ── Comeback 🐦‍🔥 ──
  {
    id: 'time-traveler',
    name: 'Time Traveler',
    emoji: '⏪',
    description: 'Went back and made up a missed day.',
    howTo: 'Open the Catch Up section and fully complete one missed day.',
    category: 'comeback', unitLabel: 'makeup days', chain: 'comeback', tier: 1, theme: 'embers',
    progress: ctx => countProgress(completeLogs(ctx).filter(l => l.isMakeUp).length, 1),
  },
  {
    id: 'phoenix',
    name: 'Phoenix',
    emoji: '🐦‍🔥',
    description: 'Rose from the ashes — 5 missed days made up.',
    howTo: 'Make up 5 missed days (all-time, any challenge). Each fully completed makeup counts.',
    category: 'comeback', unitLabel: 'makeup days', chain: 'comeback', tier: 2, theme: 'embers',
    progress: ctx => countProgress(completeLogs(ctx).filter(l => l.isMakeUp).length, 5),
  },
  {
    id: 'clean-slate',
    name: 'Clean Slate',
    emoji: '🧹',
    description: 'Fell behind, fought back, and cleared every missed day of a challenge.',
    howTo: 'Fall at least 2 days behind, make them all up, and finish every required day of a challenge.',
    category: 'comeback', unitLabel: 'days', theme: 'embers',
    progress: ctx => {
      // Needs a real comeback: a fully-complete challenge with 2+ made-up days.
      const stats = perChallengeStats(ctx).filter(s => s.makeupDays >= 2)
      const best = bestChallenge(stats, s => s.completedDays)
      if (!best) return { current: 0, target: 1, earned: false }
      return countProgress(best.completedDays, best.requiredDays)
    },
  },

  // ── Timing 🌅 ──
  {
    id: 'dawn-patrol',
    name: 'Dawn Patrol',
    emoji: '🌅',
    description: '10 full days knocked out before 7am.',
    howTo: 'Fully log your day before 7am — do it 10 times.',
    category: 'timing', unitLabel: 'early mornings', theme: 'gold',
    progress: ctx => countProgress(
      completeLogs(ctx).filter(l => {
        const h = loggedHourPT(l.loggedAt)
        return h !== null && h < 7
      }).length,
      10
    ),
  },
  {
    id: 'night-owl',
    name: 'Midnight Merkins',
    emoji: '🦉',
    description: '10 full days finished after 9pm. Cutting it close, but counting it.',
    howTo: 'Fully log your day after 9pm — 10 times. (You found the secret badge.)',
    category: 'timing', unitLabel: 'late nights', secret: true, theme: 'gold',
    progress: ctx => countProgress(
      completeLogs(ctx).filter(l => {
        const h = loggedHourPT(l.loggedAt)
        return h !== null && h >= 21
      }).length,
      10
    ),
  },

  // ── Social 📣 ──
  {
    id: 'hype-man',
    name: 'Hype Man',
    emoji: '📣',
    description: 'Gave 10 shoutouts. Lifting the whole crew.',
    howTo: 'Post 10 shoutouts to other PAX from their profile or the feed.',
    category: 'social', unitLabel: 'shoutouts', theme: 'confetti',
    progress: ctx => countProgress(ctx.shoutoutsGiven ?? 0, 10),
  },
  {
    id: 'fan-favorite',
    name: 'Fan Favorite',
    emoji: '🌟',
    description: 'Received 5 shoutouts from the PAX.',
    howTo: 'Get shouted out by other PAX 5 times. Earn it by showing up.',
    category: 'social', unitLabel: 'shoutouts', theme: 'confetti',
    progress: ctx => countProgress(ctx.shoutoutsReceived ?? 0, 5),
  },

  // ── Special 🚀 ──
  {
    id: 'launch-day',
    name: 'Launch Day',
    emoji: '🚀',
    description: 'Completed Day 1 of a challenge on the day. Started strong.',
    howTo: "Complete Day 1 of any challenge on the day itself (makeups don't count).",
    category: 'special', unitLabel: 'day ones', theme: 'confetti',
    progress: ctx => countProgress(
      completeLogs(ctx).filter(l => {
        if (l.isMakeUp) return false
        const c = CHALLENGES.find(ch => ch.id === l.challengeId)
        return !!c && l.date === c.startDate
      }).length > 0 ? 1 : 0,
      1
    ),
  },
  {
    id: 'iron-month',
    name: 'Iron Month',
    emoji: '💎',
    description: 'Every single day of a challenge, on time — zero makeups.',
    howTo: "Complete every required day of a challenge on the day it's due — zero makeups.",
    category: 'special', unitLabel: 'on-time days', theme: 'fireworks',
    progress: ctx => {
      const best = bestChallenge(perChallengeStats(ctx), s => s.onTimeDays)
      if (!best) return { current: 0, target: 30, earned: false }
      return countProgress(best.onTimeDays, best.requiredDays)
    },
  },
  {
    id: 'overachiever',
    name: 'Overachiever',
    emoji: '🎯',
    description: 'Logged 150% of a daily target. The target was a suggestion.',
    howTo: 'On any single day, log at least 1.5× the target reps and complete the day.',
    category: 'special', unitLabel: '% of target', theme: 'gold',
    progress: ctx => {
      const maxPct = ctx.logs.reduce((max, l) => {
        if (l.completionFraction < 1 || l.targetReps <= 0) return max
        return Math.max(max, Math.round((l.completedReps / l.targetReps) * 100))
      }, 0)
      return countProgress(maxPct, 150)
    },
  },
  {
    id: 'weekend-warrior',
    name: 'Weekend Warrior',
    emoji: '🪓',
    description: '12 weekend days completed. No days off.',
    howTo: 'Fully complete 12 Saturday or Sunday challenge days (all-time).',
    category: 'special', unitLabel: 'weekend days', theme: 'gold',
    progress: ctx => countProgress(
      completeLogs(ctx).filter(l => isWeekend(l.date)).length,
      12
    ),
  },
  // ── First finisher 🥇 (needs group data — firstFinisherDays in context) ──
  {
    id: 'first-blood',
    name: 'First Blood',
    emoji: '🥇',
    description: 'First PAX in the region to finish the day.',
    howTo: "Be the first PAX to fully complete a day's challenge — before everyone else.",
    category: 'special', unitLabel: 'first finishes', chain: 'first-finisher', tier: 1, theme: 'gold',
    progress: ctx => countProgress(ctx.firstFinisherDays ?? 0, 1),
  },
  {
    id: 'pace-setter',
    name: 'Pace Setter',
    emoji: '🐇',
    description: 'First to finish 5 days. The crew chases you.',
    howTo: 'Be the first PAX to complete the daily challenge on 5 different days.',
    category: 'special', unitLabel: 'first finishes', chain: 'first-finisher', tier: 2, theme: 'fireworks',
    progress: ctx => countProgress(ctx.firstFinisherDays ?? 0, 5),
  },

  // ── Advanced ──
  {
    id: 'conqueror',
    name: 'Conqueror',
    emoji: '🏰',
    description: 'Finished 3 full challenges. A dynasty in the making.',
    howTo: 'Complete every required day of 3 different challenges (makeups count).',
    category: 'special', unitLabel: 'challenges', theme: 'fireworks',
    progress: ctx => countProgress(
      perChallengeStats(ctx).filter(s => s.completedDays >= s.requiredDays).length,
      3
    ),
  },

  // ── More secrets 🤫 ──
  {
    id: 'over-9000',
    name: "It's Over 9,000!",
    emoji: '🐉',
    description: 'Total reps have exceeded 9,000. The scouter broke.',
    howTo: 'Push your all-time rep total past 9,000.',
    category: 'volume', unitLabel: 'reps', secret: true, theme: 'gold',
    progress: ctx => countProgress(totalReps(ctx), 9_001),
  },
  {
    id: 'surgeon',
    name: 'The Surgeon',
    emoji: '🔬',
    description: 'Exactly the target, 10 times. Not one rep wasted.',
    howTo: 'Complete 10 days landing exactly on the target rep count — no more, no less.',
    category: 'special', unitLabel: 'exact days', secret: true, theme: 'gold',
    progress: ctx => countProgress(
      completeLogs(ctx).filter(l => l.targetReps > 0 && l.completedReps === l.targetReps).length,
      10
    ),
  },
  {
    id: 'juggernaut',
    name: 'Juggernaut',
    emoji: '🚂',
    description: 'Blew past 150% of the target on 5 different days.',
    howTo: 'Log at least 1.5× the daily target on 5 different completed days.',
    category: 'special', unitLabel: 'overachieved days', secret: true, theme: 'fireworks',
    progress: ctx => countProgress(
      completeLogs(ctx).filter(l => l.targetReps > 0 && l.completedReps >= l.targetReps * 1.5).length,
      5
    ),
  },

  {
    id: 'bonus-hunter',
    name: 'Bonus Hunter',
    emoji: '🏹',
    description: 'Completed every bonus week of a challenge.',
    howTo: 'Complete every bonus week of a challenge that has a bonus (makeups count).',
    category: 'special', unitLabel: 'bonus weeks', theme: 'confetti',
    progress: ctx => {
      const b = ctx.bonusWeeks
      if (!b || b.total === 0) return { current: 0, target: 1, earned: false }
      return countProgress(b.completed, b.total)
    },
  },
]

export function getAchievementById(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find(a => a.id === id)
}

// ─── Evaluation ───────────────────────────────────────────────────────────────

export interface AchievementEvaluation {
  def: AchievementDefinition
  progress: AchievementProgress
}

export function evaluateAchievements(ctx: AchievementContext): AchievementEvaluation[] {
  return ACHIEVEMENTS.map(def => ({ def, progress: def.progress(ctx) }))
}

/** IDs earned in this context that aren't already in the persisted list. */
export function findNewlyEarned(
  ctx: AchievementContext,
  alreadyEarned: EarnedAchievement[] | undefined,
): AchievementDefinition[] {
  const have = new Set((alreadyEarned ?? []).map(a => a.id))
  return evaluateAchievements(ctx)
    .filter(e => e.progress.earned && !have.has(e.def.id))
    .map(e => e.def)
}

/**
 * Nearest almost-earned achievements for "next badge" advertising.
 * - skips earned, secret, and zero-progress achievements
 * - within a chain (streak/volume ladders), only the next unearned tier
 * - sorted by completion ratio (closest first)
 */
export function getNextAchievements(
  ctx: AchievementContext,
  count = 2,
): AchievementEvaluation[] {
  const evals = evaluateAchievements(ctx)
  const candidates = evals.filter(e => {
    if (e.progress.earned || e.def.secret) return false
    if (e.progress.current <= 0) return false
    if (e.def.chain) {
      // Only the lowest unearned tier of a chain
      const lowerUnearned = evals.some(other =>
        other.def.chain === e.def.chain &&
        (other.def.tier ?? 0) < (e.def.tier ?? 0) &&
        !other.progress.earned
      )
      if (lowerUnearned) return false
    }
    return true
  })
  return candidates
    .sort((a, b) =>
      b.progress.current / b.progress.target - a.progress.current / a.progress.target
    )
    .slice(0, count)
}

/** "2 days away", "300 reps away", "1 makeup day away" */
export function nearMissLabel(e: AchievementEvaluation): string {
  const remaining = Math.max(0, e.progress.target - e.progress.current)
  let unit = e.def.unitLabel
  if (remaining === 1 && unit.endsWith('s') && !unit.endsWith('ss')) {
    unit = unit.slice(0, -1)
  }
  return `${remaining.toLocaleString()} ${unit} away`
}
