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

import {
  CHALLENGES,
  getRequiredDays,
  getChallengeDates,
  getChallengeWeeks,
  getWeeksCompleted,
  getTodayPT,
  isRestDay,
  conditionalRestApplies,
} from './challenges'
import type { ChallengeBadgeDef, ChallengeTemplate } from './types'

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
  /** Reps per exercise id. Needed by badges that care which movement it was
   *  ("100 chin-ups", "all four variations in one week"). Absent on logs
   *  mapped by older callers — those badges simply don't progress. */
  exerciseReps?: Record<string, number>
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
  /** Days where this user finished last among 3+ finishers (The Six). */
  lastFinisherDays?: number
  /** Days where this user finished within 5 minutes of another PAX. */
  photoFinishDays?: number
  /** Days where the entire active roster (5+ PAX) finished, this user included. */
  fullHouseDays?: number
  /** Feed comments this user has posted. */
  commentsPosted?: number
  /** Photos this user has attached to feed posts (cumulative across posts). */
  photosUploaded?: number
  /** Videos this user has attached to feed posts (cumulative across posts). */
  videosUploaded?: number
  /** Callouts where the called-out PAX went on to finish that day. */
  successfulCallouts?: number
  /** Achievements already earned (excluding Completionist itself). */
  earnedBadgesCount?: number
  /** Shoutout coverage of the current challenge's active PAX (Ambassador). */
  shoutoutCoverage?: { covered: number; total: number }
  /** Challenge ids where this user's participation status is 'modifying'. */
  modifyingChallengeIds?: string[]
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

/** PT calendar date (YYYY-MM-DD) of an ISO timestamp; null if missing/invalid. */
function ptDate(iso?: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
}

/** PT wall-clock time (HH:MM, 24h) of an ISO timestamp; null if missing/invalid. */
function ptClock(iso?: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleTimeString('en-GB', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hour12: false })
}

function addDaysStr(date: string, n: number): string {
  const d = new Date(date + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Most day-completions finished within a single PT calendar day. */
function maxSameDayCompletions(ctx: AchievementContext): number {
  const byDay = new Map<string, number>()
  for (const l of completeLogs(ctx)) {
    const day = ptDate(l.loggedAt)
    if (!day) continue
    byDay.set(day, (byDay.get(day) ?? 0) + 1)
  }
  return byDay.size ? Math.max(...byDay.values()) : 0
}

function stackAchievement(id: string, name: string, emoji: string, description: string, count: number, tier: number): AchievementDefinition {
  return {
    id, name, emoji, description,
    howTo: `Fully complete ${count} challenge days (today + makeups) within one calendar day.`,
    category: 'special', unitLabel: 'same-day completions', chain: 'stack', tier, theme: tier >= 3 ? 'fireworks' : 'embers',
    progress: ctx => countProgress(maxSameDayCompletions(ctx), count),
  }
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

const CORE_ACHIEVEMENTS: AchievementDefinition[] = [
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
    howTo: 'Fall at least 2 days behind in a challenge, then make up every missed day — clear the whole debt.',
    category: 'comeback', unitLabel: 'makeup days', theme: 'embers',
    progress: ctx => {
      // Progress is makeup debt cleared: current = days made up, target = total
      // debt (made up + still missed). Earned when a challenge where you fell
      // 2+ days behind has zero missed days left.
      const today = getTodayPT()
      let best: AchievementProgress | null = null
      for (const c of CHALLENGES) {
        const logs = ctx.logs.filter(l => l.challengeId === c.id)
        if (logs.length === 0) continue
        const complete = logs.filter(l => l.completionFraction >= 1)
        const completedDates = complete.map(l => l.date)
        const completedSet = new Set(completedDates)
        const madeUp = complete.filter(l => l.isMakeUp).length
        const missed = getChallengeDates(c).filter(d =>
          d < today &&
          !isRestDay(c, d) &&
          !conditionalRestApplies(c, d, completedDates) &&
          !completedSet.has(d)
        ).length
        const debt = madeUp + missed
        if (debt < 2) continue // never fell 2+ days behind — no comeback story
        const p = countProgress(madeUp, debt)
        if (!best || p.current / p.target > best.current / best.target) best = p
      }
      return best ?? { current: 0, target: 2, earned: false }
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
      // A single past day not completed on time makes a perfect month
      // impossible — those challenges don't count as progress (no dangling
      // "5 days away" for a badge that can no longer be earned there).
      const today = getTodayPT()
      let best: AchievementProgress | null = null
      for (const c of CHALLENGES) {
        const logs = ctx.logs.filter(l => l.challengeId === c.id)
        if (logs.length === 0) continue
        const completedDates = logs.filter(l => l.completionFraction >= 1).map(l => l.date)
        const onTime = new Set(
          logs.filter(l => l.completionFraction >= 1 && !l.isMakeUp).map(l => l.date)
        )
        const requiredDates = getChallengeDates(c).filter(d =>
          !isRestDay(c, d) && !conditionalRestApplies(c, d, completedDates)
        )
        const broken = requiredDates.some(d => d < today && !onTime.has(d))
        if (broken) continue
        const p = countProgress(onTime.size, requiredDates.length)
        if (!best || p.current / p.target > best.current / best.target) best = p
      }
      return best ?? { current: 0, target: 30, earned: false }
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

  // ── Group finishes 🐢 ──
  {
    id: 'the-six',
    name: 'The Six',
    emoji: '🐢',
    description: 'Finished last — but finished. 5 times. Nobody left behind.',
    howTo: 'Fully complete the day as the last finisher of the group (on days when 3+ PAX finish). Do it 5 times.',
    category: 'special', unitLabel: 'last finishes', theme: 'confetti',
    progress: ctx => countProgress(ctx.lastFinisherDays ?? 0, 5),
  },
  {
    id: 'full-house',
    name: 'Full House',
    emoji: '🤝',
    description: 'Completed on a day the WHOLE crew finished. All of us.',
    howTo: 'Complete your day on a day when every active PAX finishes theirs (5+ PAX). The whole group unlocks it together.',
    category: 'special', unitLabel: 'full-house days', theme: 'fireworks',
    progress: ctx => countProgress(ctx.fullHouseDays ?? 0, 1),
  },
  {
    id: 'photo-finish',
    name: 'Photo Finish',
    emoji: '📸',
    description: 'Finished within 5 minutes of another PAX. Too close to call.',
    howTo: 'Complete your day within 5 minutes of another PAX completing theirs.',
    category: 'special', unitLabel: 'photo finishes', secret: true, theme: 'gold',
    progress: ctx => countProgress(ctx.photoFinishDays ?? 0, 1),
  },

  // ── Same-day stacks 🎒 ──
  stackAchievement('double-duty', 'Double Duty', '🎒', 'Two full days knocked out in one calendar day.', 2, 1),
  stackAchievement('triple-threat', 'Triple Threat', '⚔️', 'Three full days in one calendar day. Relentless.', 3, 2),
  stackAchievement('quad-stack', 'Quad Stack', '🧱', 'FOUR full days in one calendar day. Absurd. Respect.', 4, 3),

  // ── Fast comeback 🏀 ──
  {
    id: 'quick-rebound',
    name: 'Quick Rebound',
    emoji: '🏀',
    description: 'Missed a day, took it back within 48 hours — 3 times.',
    howTo: 'Make up a missed day within 2 days of missing it. Do it 3 times. Never let one miss become two.',
    category: 'comeback', unitLabel: 'quick rebounds', theme: 'embers',
    progress: ctx => countProgress(
      completeLogs(ctx).filter(l => {
        if (!l.isMakeUp) return false
        const doneDay = ptDate(l.loggedAt)
        return doneDay !== null && doneDay <= addDaysStr(l.date, 2)
      }).length,
      3
    ),
  },

  // ── Buzzer beater 🚨 ──
  {
    id: 'buzzer-beater',
    name: 'Buzzer Beater',
    emoji: '🚨',
    description: 'Completed the day in the final 15 minutes before midnight.',
    howTo: 'Finish your day between 11:45pm and midnight. Cutting it close still counts.',
    category: 'timing', unitLabel: 'buzzer beaters', secret: true, theme: 'gold',
    progress: ctx => countProgress(
      completeLogs(ctx).filter(l => {
        if (l.isMakeUp) return false
        const clock = ptClock(l.loggedAt)
        // Must be finished on its own day, in the last 15 minutes of it
        return clock !== null && clock >= '23:45' && ptDate(l.loggedAt) === l.date
      }).length,
      1
    ),
  },

  // ── More socials 💬 ──
  {
    id: 'conversationalist',
    name: 'Conversationalist',
    emoji: '💬',
    description: '25 comments in the feed. Keeping the fire going.',
    howTo: 'Post 25 comments on feed posts.',
    category: 'social', unitLabel: 'comments', theme: 'confetti',
    progress: ctx => countProgress(ctx.commentsPosted ?? 0, 25),
  },

  // ── Feed media 📸 ──
  {
    id: 'pics-or-it-didnt-happen',
    name: "Pics or It Didn't Happen",
    emoji: '📸',
    description: 'Posted your first photo to the feed. Proof of the pain.',
    howTo: 'Attach at least 1 photo to a feed post.',
    category: 'social', unitLabel: 'photos', chain: 'photos', tier: 1, theme: 'confetti',
    progress: ctx => countProgress(ctx.photosUploaded ?? 0, 1),
  },
  {
    id: 'shutterbug',
    name: 'Shutterbug',
    emoji: '📷',
    description: '5 photos posted to the feed. The unofficial AO photographer.',
    howTo: 'Attach 5 photos to feed posts — across any number of posts.',
    category: 'social', unitLabel: 'photos', chain: 'photos', tier: 2, theme: 'confetti',
    progress: ctx => countProgress(ctx.photosUploaded ?? 0, 5),
  },
  {
    id: 'lights-camera-merkin',
    name: 'Lights, Camera, Merkin',
    emoji: '🎬',
    description: 'Posted your first video to the feed. Roll tape.',
    howTo: 'Attach at least 1 video to a feed post.',
    category: 'social', unitLabel: 'videos', chain: 'videos', tier: 1, theme: 'confetti',
    progress: ctx => countProgress(ctx.videosUploaded ?? 0, 1),
  },
  {
    id: 'directors-cut',
    name: "Director's Cut",
    emoji: '🎞️',
    description: '3 videos in the feed. Putting together a whole highlight reel.',
    howTo: 'Attach 3 videos to feed posts — across any number of posts.',
    category: 'social', unitLabel: 'videos', chain: 'videos', tier: 2, theme: 'confetti',
    progress: ctx => countProgress(ctx.videosUploaded ?? 0, 3),
  },
  {
    id: 'ambassador',
    name: 'Ambassador',
    emoji: '🌍',
    description: 'Shouted out every PAX in the challenge. Nobody gets hyped alone.',
    howTo: 'Give at least one shoutout to every other active PAX during a challenge (needs 5+ active PAX).',
    category: 'social', unitLabel: 'PAX covered', theme: 'confetti',
    progress: ctx => {
      const cov = ctx.shoutoutCoverage
      // Coverage only means something with a real roster
      if (!cov || cov.total < 5) {
        return { current: cov?.covered ?? 0, target: Math.max(cov?.total ?? 0, 5), earned: false }
      }
      return countProgress(cov.covered, cov.total)
    },
  },
  {
    id: 'shot-caller',
    name: 'Shot Caller',
    emoji: '🧲',
    description: 'Called out 3 PAX who then went and finished. Words that move.',
    howTo: 'Call out a PAX on a day they go on to complete the challenge — 3 times.',
    category: 'social', unitLabel: 'successful callouts', theme: 'confetti',
    progress: ctx => countProgress(ctx.successfulCallouts ?? 0, 3),
  },

  // ── Meta 🎖️ ──
  {
    id: 'completionist',
    name: 'Completionist',
    emoji: '🎖️',
    description: '25 badges in the trophy case. You collect glory.',
    howTo: 'Earn 25 other achievements — secrets included. The badge for chasing badges.',
    category: 'special', unitLabel: 'badges', theme: 'fireworks',
    progress: ctx => countProgress(ctx.earnedBadgesCount ?? 0, 25),
  },

  // ── Advanced ──
  {
    id: 'adapt-and-overcome',
    name: 'Adapt & Overcome',
    emoji: '🧗',
    description: 'Finished a full challenge your own way — scaled, modified, but done.',
    howTo: 'Complete every required day of a challenge while your status is set to ✏️ Modifying. Makeups count.',
    category: 'special', unitLabel: 'challenges', theme: 'fireworks',
    progress: ctx => {
      const modifying = new Set(ctx.modifyingChallengeIds ?? [])
      const done = perChallengeStats(ctx).filter(
        s => modifying.has(s.challengeId) && s.completedDays >= s.requiredDays
      ).length
      return countProgress(done, 1)
    },
  },
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

// ─── Challenge signature badges ───────────────────────────────────────────────
// Challenges can ship their own badges as data (ChallengeTemplate.badges);
// they become full achievements here. Adding a challenge with badges is still
// a single-object change in challenges.ts.

/** This user's logs for one challenge. */
function challengeLogs(ctx: AchievementContext, challengeId: string): AchievementLogInput[] {
  return ctx.logs.filter(l => l.challengeId === challengeId)
}

/** Progress rule + near-miss noun for one badge criteria. */
function criteriaRule(
  c: ChallengeTemplate,
  crit: ChallengeBadgeDef['criteria'],
): { unitLabel: string; progress: (ctx: AchievementContext) => AchievementProgress } {
  const weekly = c.type === 'weekly-cumulative'

  switch (crit.type) {
    case 'complete-days':
      return {
        unitLabel: 'days',
        progress: ctx => countProgress(
          challengeLogs(ctx, c.id).filter(l => l.completionFraction >= 1).length,
          crit.days,
        ),
      }

    case 'challenge-reps':
      return {
        unitLabel: 'reps',
        progress: ctx => countProgress(
          challengeLogs(ctx, c.id).reduce((s, l) => s + l.completedReps, 0),
          crit.reps,
        ),
      }

    case 'exercise-reps':
      return {
        unitLabel: 'reps',
        progress: ctx => countProgress(
          challengeLogs(ctx, c.id)
            .reduce((s, l) => s + (l.exerciseReps?.[crit.exerciseId] ?? 0), 0),
          crit.reps,
        ),
      }

    case 'single-day-reps':
      return {
        unitLabel: 'reps',
        progress: ctx => countProgress(
          // Best single day so far — near-miss copy then reads "12 reps away".
          challengeLogs(ctx, c.id).reduce((best, l) => Math.max(best, l.completedReps), 0),
          crit.reps,
        ),
      }

    case 'weeks-completed':
      return {
        unitLabel: 'weeks',
        progress: ctx => countProgress(
          getWeeksCompleted(c, getTodayPT(), challengeLogs(ctx, c.id)),
          crit.weeks,
        ),
      }

    case 'week-variety':
      return {
        unitLabel: 'variations',
        progress: ctx => {
          // The best single week: most distinct exercises logged inside one.
          const best = getChallengeWeeks(c).reduce((max, w) => {
            const ids = new Set<string>()
            for (const l of challengeLogs(ctx, c.id)) {
              if (l.date < w.startDate || l.date > w.endDate) continue
              for (const [id, reps] of Object.entries(l.exerciseReps ?? {})) {
                if (reps > 0) ids.add(id)
              }
            }
            return Math.max(max, ids.size)
          }, 0)
          return countProgress(best, c.exercises.length)
        },
      }

    case 'week-early':
      return {
        unitLabel: 'weeks',
        progress: ctx => {
          const logs = challengeLogs(ctx, c.id)
          // Did any week hit its target with `daysEarly` days still to run?
          const hit = getChallengeWeeks(c).some(w => {
            const cutoff = addDays(w.endDate, -crit.daysEarly)
            const reps = logs
              .filter(l => l.date >= w.startDate && l.date <= cutoff)
              .reduce((s, l) => s + l.completedReps, 0)
            return reps >= w.target
          })
          return countProgress(hit ? 1 : 0, 1)
        },
      }

    case 'complete-challenge':
    default:
      return weekly
        ? {
            unitLabel: 'weeks',
            progress: ctx => countProgress(
              getWeeksCompleted(c, getTodayPT(), challengeLogs(ctx, c.id)),
              getChallengeWeeks(c).length,
            ),
          }
        : {
            unitLabel: 'days',
            progress: ctx => countProgress(
              challengeLogs(ctx, c.id).filter(l => l.completionFraction >= 1).length,
              getRequiredDays(c),
            ),
          }
  }
}

/** YYYY-MM-DD shifted by `delta` days. Noon UTC keeps it timezone-stable. */
function addDays(date: string, delta: number): string {
  const d = new Date(date + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

function challengeBadgeDefinition(c: ChallengeTemplate, b: ChallengeBadgeDef): AchievementDefinition {
  const rule = criteriaRule(c, b.criteria)
  return {
    id: b.id,
    name: b.name,
    emoji: b.emoji,
    description: b.description,
    howTo: b.howTo,
    category: 'special',
    unitLabel: b.unitLabel ?? rule.unitLabel,
    theme: 'confetti',
    progress: rule.progress,
  }
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  ...CORE_ACHIEVEMENTS,
  ...CHALLENGES.flatMap(c => (c.badges ?? []).map(b => challengeBadgeDefinition(c, b))),
]

/** Badge of the Month for a challenge, if it declares one. */
export function getFeaturedAchievement(challenge: ChallengeTemplate): AchievementDefinition | undefined {
  if (!challenge.featuredBadgeId) return undefined
  return ACHIEVEMENTS.find(a => a.id === challenge.featuredBadgeId)
}

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
 * - with a rotateSeed (e.g. derived from today's date): slot 1 stays the
 *   closest badge, while the remaining slots rotate through the other
 *   candidates so the card doesn't go stale between unlocks
 */
export function getNextAchievements(
  ctx: AchievementContext,
  count = 2,
  rotateSeed?: number,
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
  const sorted = candidates.sort((a, b) =>
    b.progress.current / b.progress.target - a.progress.current / a.progress.target
  )
  if (rotateSeed === undefined || sorted.length <= count) return sorted.slice(0, count)

  const picked = [sorted[0]]
  const rest = sorted.slice(1)
  for (let i = 0; i < count - 1 && rest.length > 0; i++) {
    picked.push(rest.splice((rotateSeed + i) % rest.length, 1)[0])
  }
  return picked
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
