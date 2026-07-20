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
  getChallengeById,
} from '@/lib/challenges'
import type {
  AchievementContext,
  AchievementDefinition,
  AchievementLogInput,
  BonusLog,
  DailyLog,
  EarnedAchievement,
  FeedPost,
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

const finishTime = (l: DailyLog) => l.completedAt ?? l.updatedAt ?? l.loggedAt

export interface GroupFinishStats {
  firstFinisherDays: number
  lastFinisherDays: number
  photoFinishDays: number
  fullHouseDays: number
}

/**
 * Per-day finish placements for `userId` from the whole group's logs:
 * - first: earliest completion of the day (First Blood / Pace Setter)
 * - last: latest completion on days with 3+ finishers (The Six)
 * - photo: finished within 5 minutes of another PAX (Photo Finish)
 * - fullHouse: the entire roster (everyone with any log this challenge,
 *   min 5 PAX) finished, this user included (Full House)
 * Only on-time (non-makeup) complete logs count. Legacy logs without
 * completedAt fall back to their last write time.
 */
export function computeGroupFinishStats(groupLogs: DailyLog[], userId: string): GroupFinishStats {
  const roster = new Set(groupLogs.map(l => l.userId))
  const byDate = new Map<string, DailyLog[]>()
  for (const log of groupLogs) {
    if (log.completionFraction < 1 || log.isMakeUp) continue
    const arr = byDate.get(log.date) ?? []
    arr.push(log)
    byDate.set(log.date, arr)
  }

  const stats: GroupFinishStats = {
    firstFinisherDays: 0, lastFinisherDays: 0, photoFinishDays: 0, fullHouseDays: 0,
  }
  const FIVE_MIN = 5 * 60_000

  for (const logs of byDate.values()) {
    const sorted = [...logs].sort((a, b) => finishTime(a).localeCompare(finishTime(b)))
    if (sorted[0].userId === userId) stats.firstFinisherDays++
    if (sorted.length >= 3 && sorted[sorted.length - 1].userId === userId) stats.lastFinisherDays++

    const mine = sorted.find(l => l.userId === userId)
    if (mine) {
      const myTime = new Date(finishTime(mine)).getTime()
      const close = sorted.some(l =>
        l.userId !== userId && Math.abs(new Date(finishTime(l)).getTime() - myTime) <= FIVE_MIN
      )
      if (close) stats.photoFinishDays++

      const finishers = new Set(sorted.map(l => l.userId))
      if (roster.size >= 5 && [...roster].every(id => finishers.has(id))) {
        stats.fullHouseDays++
      }
    }
  }
  return stats
}

/**
 * Callouts that landed: this user shouted out a PAX, and that PAX went on to
 * complete the challenge that same day (finish after the callout). Distinct
 * per target per day, so spamming one PAX doesn't farm the badge.
 */
export function countSuccessfulCallouts(
  givenShoutouts: Array<Pick<FeedPost, 'targetUserId' | 'createdAt'>>,
  groupLogs: DailyLog[],
): number {
  const logByUserDate = new Map<string, DailyLog>()
  for (const l of groupLogs) {
    if (l.completionFraction < 1 || l.isMakeUp) continue
    logByUserDate.set(`${l.userId}_${l.date}`, l)
  }
  const hits = new Set<string>()
  for (const post of givenShoutouts) {
    if (!post.targetUserId) continue
    const day = new Date(post.createdAt).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
    const key = `${post.targetUserId}_${day}`
    const log = logByUserDate.get(key)
    if (log && finishTime(log) > post.createdAt) hits.add(key)
  }
  return hits.size
}

/**
 * Shoutout coverage of the current challenge's roster: how many of the other
 * active PAX (anyone with a log this challenge) this user has shouted out.
 */
export function computeShoutoutCoverage(
  givenShoutouts: Array<Pick<FeedPost, 'targetUserId' | 'challengeId'>>,
  groupLogs: DailyLog[],
  userId: string,
  challengeId?: string,
): { covered: number; total: number } {
  const participants = new Set(groupLogs.map(l => l.userId))
  participants.delete(userId)
  const covered = new Set(
    givenShoutouts
      .filter(p =>
        p.targetUserId &&
        (!challengeId || p.challengeId === challengeId) &&
        participants.has(p.targetUserId)
      )
      .map(p => p.targetUserId as string)
  )
  return { covered: covered.size, total: participants.size }
}

export interface AchievementExtras {
  shoutoutsGiven?: number
  shoutoutsReceived?: number
  bonusLogs?: BonusLog[]
  commentsPosted?: number
  photosUploaded?: number
  videosUploaded?: number
  /** This user's outgoing shoutout posts (for Shot Caller / Ambassador). */
  givenShoutouts?: Array<Pick<FeedPost, 'targetUserId' | 'createdAt' | 'challengeId'>>
  /** All logs for the current challenge, every user (group placements). */
  groupLogs?: DailyLog[]
  /** Current challenge id — scopes Ambassador coverage to this challenge. */
  currentChallengeId?: string
  /** Challenge ids where this user's participation status is 'modifying'. */
  modifyingChallengeIds?: string[]
}

export function buildAchievementContext(
  user: Pick<User, 'id' | 'longestStreak' | 'currentStreak' | 'achievements'>,
  allLogs: DailyLog[],
  extras?: AchievementExtras,
): AchievementContext {
  const group = extras?.groupLogs ? computeGroupFinishStats(extras.groupLogs, user.id) : undefined
  return {
    logs: allLogs.map(toAchievementLog),
    longestStreak: Math.max(user.longestStreak ?? 0, user.currentStreak ?? 0),
    shoutoutsGiven: extras?.shoutoutsGiven ?? extras?.givenShoutouts?.length,
    shoutoutsReceived: extras?.shoutoutsReceived,
    bonusWeeks: extras?.bonusLogs ? bestBonusWeeks(extras.bonusLogs) : undefined,
    firstFinisherDays: group?.firstFinisherDays,
    lastFinisherDays: group?.lastFinisherDays,
    photoFinishDays: group?.photoFinishDays,
    fullHouseDays: group?.fullHouseDays,
    commentsPosted: extras?.commentsPosted,
    photosUploaded: extras?.photosUploaded,
    videosUploaded: extras?.videosUploaded,
    successfulCallouts: extras?.givenShoutouts && extras?.groupLogs
      ? countSuccessfulCallouts(extras.givenShoutouts, extras.groupLogs)
      : undefined,
    shoutoutCoverage: extras?.givenShoutouts && extras?.groupLogs
      ? computeShoutoutCoverage(extras.givenShoutouts, extras.groupLogs, user.id, extras.currentChallengeId)
      : undefined,
    earnedBadgesCount: (user.achievements ?? []).filter(a => a.id !== 'completionist').length,
    modifyingChallengeIds: extras?.modifyingChallengeIds,
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

  const featuredBadgeId = challengeId ? getChallengeById(challengeId)?.featuredBadgeId : undefined

  await Promise.all(
    fresh.map(def => {
      const template = UNLOCK_POST_TEMPLATES[Math.floor(Math.random() * UNLOCK_POST_TEMPLATES.length)]
      const flair = def.id === featuredBadgeId ? '🎪 BADGE OF THE MONTH! ' : ''
      const content = flair + template
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
