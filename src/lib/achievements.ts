/**
 * Client-side achievement engine.
 *
 * Definitions + progress math live in shared/src/achievements.ts (usable by
 * Cloud Functions too). This file adapts app data (DailyLog, feed, bonus logs)
 * into an AchievementContext, and persists awards to the user document.
 */

import {
  ACHIEVEMENTS,
  evaluateAchievements,
  findNewlyEarned,
  getNextAchievements,
  CHALLENGES,
} from '@/lib/challenges'
import type {
  AchievementContext,
  AchievementDefinition,
  AchievementLogInput,
  BonusLog,
  DailyLog,
  EarnedAchievement,
  User,
} from '@/types'
import { updateUser, createFeedPostOnce } from '@/lib/firestore'
import { extractHashtags, stripUndefined } from '@/lib/utils'

export { ACHIEVEMENTS, evaluateAchievements, findNewlyEarned, getNextAchievements }

// ─── Context building ─────────────────────────────────────────────────────────

export function toAchievementLog(log: DailyLog): AchievementLogInput {
  return {
    date: log.date,
    challengeId: log.challengeId,
    completionFraction: log.completionFraction,
    isMakeUp: log.isMakeUp ?? false,
    // Timing badges want the moment the day was finished, not the last edit
    loggedAt: log.completedAt ?? log.updatedAt ?? log.loggedAt,
    completedReps: log.exerciseLogs.reduce((s, e) => s + e.completedReps, 0),
    targetReps: log.exerciseLogs.reduce((s, e) => s + e.targetReps, 0),
  }
}

/** Best bonus-week completion across challenges (bonus-hunter is per challenge). */
function bestBonusWeeks(bonusLogs: BonusLog[]): { completed: number; total: number } | undefined {
  let best: { completed: number; total: number } | undefined
  for (const c of CHALLENGES) {
    const total = c.bonusChallenge?.weeks.length ?? 0
    if (total === 0) continue
    const completed = bonusLogs.filter(b => b.challengeId === c.id).length
    if (!best || completed / total > best.completed / best.total) {
      best = { completed: Math.min(completed, total), total }
    }
  }
  return best
}

/**
 * Days where `userId` was the first PAX to fully complete the challenge.
 * Winner per date = earliest completion timestamp among on-time (non-makeup)
 * complete logs. Legacy logs without completedAt fall back to their last write.
 */
export function countFirstFinisherDays(groupLogs: DailyLog[], userId: string): number {
  const finishTime = (l: DailyLog) => l.completedAt ?? l.updatedAt ?? l.loggedAt
  const byDate = new Map<string, DailyLog>()
  for (const log of groupLogs) {
    if (log.completionFraction < 1 || log.isMakeUp) continue
    const current = byDate.get(log.date)
    if (!current || finishTime(log) < finishTime(current)) byDate.set(log.date, log)
  }
  let count = 0
  for (const winner of byDate.values()) {
    if (winner.userId === userId) count++
  }
  return count
}

export function buildAchievementContext(
  user: Pick<User, 'longestStreak' | 'currentStreak'>,
  allLogs: DailyLog[],
  extras?: {
    shoutoutsGiven?: number
    shoutoutsReceived?: number
    bonusLogs?: BonusLog[]
    firstFinisherDays?: number
  }
): AchievementContext {
  return {
    logs: allLogs.map(toAchievementLog),
    longestStreak: Math.max(user.longestStreak ?? 0, user.currentStreak ?? 0),
    shoutoutsGiven: extras?.shoutoutsGiven,
    shoutoutsReceived: extras?.shoutoutsReceived,
    bonusWeeks: extras?.bonusLogs ? bestBonusWeeks(extras.bonusLogs) : undefined,
    firstFinisherDays: extras?.firstFinisherDays,
  }
}

// ─── Awarding ─────────────────────────────────────────────────────────────────

const UNLOCK_POST_TEMPLATES = [
  '@{name} unlocked {emoji} {title} — {description}',
  'Achievement unlocked: @{name} earned {emoji} {title}. {description}',
  '{emoji} @{name} just claimed the {title} badge — {description}',
]

/**
 * Persist newly earned achievements and broadcast each to the feed.
 * Feed post IDs are deterministic (achievement_{userId}_{id}) so re-awards
 * can never double-post.
 */
export async function awardAchievements(
  user: Pick<User, 'id' | 'displayName' | 'achievements'>,
  defs: AchievementDefinition[],
  challengeId?: string,
): Promise<EarnedAchievement[]> {
  if (defs.length === 0) return []
  const now = new Date().toISOString()
  const existing = user.achievements ?? []
  const existingIds = new Set(existing.map(a => a.id))
  const fresh = defs.filter(d => !existingIds.has(d.id))
  if (fresh.length === 0) return []

  const earned: EarnedAchievement[] = fresh.map(d => ({ id: d.id, awardedAt: now }))
  await updateUser(user.id, { achievements: [...existing, ...earned] })

  await Promise.all(
    fresh.map(def => {
      const template = UNLOCK_POST_TEMPLATES[Math.floor(Math.random() * UNLOCK_POST_TEMPLATES.length)]
      const content = template
        .replace('{name}', user.displayName)
        .replace('{emoji}', def.emoji)
        .replace('{title}', def.name)
        .replace('{description}', def.description)
      return createFeedPostOnce(stripUndefined({
        id: `achievement_${user.id}_${def.id}`,
        type: 'system' as const,
        authorId: 'system',
        content,
        hashtags: extractHashtags(content),
        mentions: [user.id],
        challengeId,
        createdAt: now,
        deleted: false,
      })).catch(() => { /* feed post is best-effort; the award itself succeeded */ })
    })
  )

  return earned
}
