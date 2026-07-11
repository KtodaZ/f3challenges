/**
 * Firestore collection paths and typed query helpers.
 * All write operations go through these helpers to ensure consistent document IDs.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  deleteField,
} from 'firebase/firestore'
import { db } from './firebase'
import { stripUndefined } from './utils'
import type {
  User,
  DailyLog,
  FeedPost,
  FeedComment,
  AppNotification,
  ChallengeParticipation,
  BonusLog,
} from '@/types'

// ─── Collection References ────────────────────────────────────────────────────

export const usersCol         = () => collection(db, 'users')
export const dailyLogsCol     = () => collection(db, 'dailyLogs')
export const feedCol          = () => collection(db, 'feed')
export const participationCol = () => collection(db, 'participation')
export const bonusLogsCol     = () => collection(db, 'bonusLogs')
export const notificationsCol = (userId: string) =>
  collection(db, 'notifications', userId, 'items')

// ─── Document ID Helpers ──────────────────────────────────────────────────────

export const dailyLogId      = (userId: string, date: string) => `${userId}_${date}`
export const participationId = (userId: string, challengeId: string) => `${userId}_${challengeId}`
export const bonusLogId      = (challengeId: string, weekStartDate: string, userId: string) =>
  `${challengeId}_${weekStartDate}_${userId}`

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUser(userId: string): Promise<User | null> {
  const snap = await getDoc(doc(usersCol(), userId))
  return snap.exists() ? (snap.data() as User) : null
}

export async function getAllUsers(): Promise<User[]> {
  const snap = await getDocs(usersCol())
  return snap.docs.map(d => d.data() as User)
}

export async function upsertUser(user: User): Promise<void> {
  await setDoc(doc(usersCol(), user.id), user, { merge: true })
}

export async function updateUser(userId: string, updates: Partial<User>): Promise<void> {
  await updateDoc(doc(usersCol(), userId), updates as Record<string, unknown>)
}

export async function setBadge(
  userId: string,
  badge: import('@/types').AchievementBadge,
  currentBadges: import('@/types').AchievementBadge[]
): Promise<void> {
  const filtered = currentBadges.filter(b => b.challengeId !== badge.challengeId)
  await updateDoc(doc(usersCol(), userId), { badges: [...filtered, badge] })
}

export async function clearPendingCelebration(userId: string): Promise<void> {
  await updateDoc(doc(usersCol(), userId), { pendingCelebration: deleteField() })
}

export function subscribeToUsers(callback: (users: User[]) => void) {
  return onSnapshot(usersCol(), snap => {
    callback(snap.docs.map(d => d.data() as User))
  })
}

// ─── Daily Logs ───────────────────────────────────────────────────────────────

export async function getDailyLog(userId: string, date: string): Promise<DailyLog | null> {
  const snap = await getDoc(doc(dailyLogsCol(), dailyLogId(userId, date)))
  return snap.exists() ? (snap.data() as DailyLog) : null
}

export async function upsertDailyLog(log: DailyLog): Promise<void> {
  await setDoc(doc(dailyLogsCol(), log.id), log, { merge: true })
}

/** Get all logs for a user in a challenge (for heat map / streak calc). */
export async function getUserChallengeLogs(
  userId: string,
  challengeId: string
): Promise<DailyLog[]> {
  const q = query(
    dailyLogsCol(),
    where('userId', '==', userId),
    where('challengeId', '==', challengeId),
    orderBy('date', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data() as DailyLog)
}

/** All logs for a challenge, every user (first-finisher achievement). */
export async function getChallengeLogs(challengeId: string): Promise<DailyLog[]> {
  const q = query(dailyLogsCol(), where('challengeId', '==', challengeId))
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data() as DailyLog)
}

/** Get all logs for a challenge on a specific date (leaderboard). */
export async function getLogsForDate(challengeId: string, date: string): Promise<DailyLog[]> {
  const q = query(
    dailyLogsCol(),
    where('challengeId', '==', challengeId),
    where('date', '==', date)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data() as DailyLog)
}

/**
 * IDs of users with at least one log in this challenge.
 * One limit(1) query per user — 1 doc read each — instead of fetching every log.
 */
export async function getUsersWithChallengeLogs(
  challengeId: string,
  userIds: string[]
): Promise<Set<string>> {
  const results = await Promise.all(
    userIds.map(async userId => {
      const q = query(
        dailyLogsCol(),
        where('userId', '==', userId),
        where('challengeId', '==', challengeId),
        limit(1)
      )
      const snap = await getDocs(q)
      return snap.empty ? null : userId
    })
  )
  return new Set(results.filter((id): id is string => id !== null))
}

export function subscribeToDailyLog(
  userId: string,
  date: string,
  callback: (log: DailyLog | null) => void
) {
  return onSnapshot(doc(dailyLogsCol(), dailyLogId(userId, date)), snap => {
    callback(snap.exists() ? (snap.data() as DailyLog) : null)
  })
}

// ─── Participation ────────────────────────────────────────────────────────────

export async function getParticipation(
  userId: string,
  challengeId: string
): Promise<ChallengeParticipation | null> {
  const snap = await getDoc(doc(participationCol(), participationId(userId, challengeId)))
  return snap.exists() ? (snap.data() as ChallengeParticipation) : null
}

export async function upsertParticipation(p: ChallengeParticipation): Promise<void> {
  await setDoc(doc(participationCol(), p.id), p, { merge: true })
}

export async function getChallengeParticipants(challengeId: string): Promise<ChallengeParticipation[]> {
  const q = query(participationCol(), where('challengeId', '==', challengeId))
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data() as ChallengeParticipation)
}

// ─── Feed ─────────────────────────────────────────────────────────────────────

export async function createFeedPost(post: FeedPost): Promise<void> {
  await setDoc(doc(feedCol(), post.id), post)
}

/** Creates a feed post only if a doc with that ID doesn't already exist. */
export async function createFeedPostOnce(post: FeedPost): Promise<void> {
  const ref = doc(feedCol(), post.id)
  const snap = await getDoc(ref)
  if (snap.exists()) return
  await setDoc(ref, post)
}

export async function updateFeedPost(postId: string, updates: Partial<FeedPost>): Promise<void> {
  await updateDoc(doc(feedCol(), postId), { ...updates, updatedAt: new Date().toISOString() })
}

export async function softDeletePost(postId: string): Promise<void> {
  await updateDoc(doc(feedCol(), postId), { deleted: true })
}

/**
 * Live feed listener over a growing window. `pageSize` is the number of posts
 * currently shown; the query fetches one extra doc so the caller can tell
 * whether older posts exist (infinite-scroll trigger). Re-subscribe with a
 * larger `pageSize` to load more — the newest page stays real-time throughout.
 */
export function subscribeToFeed(
  callback: (result: { posts: FeedPost[]; hasMore: boolean }) => void,
  pageSize = 30
) {
  const q = query(
    feedCol(),
    where('deleted', '==', false),
    orderBy('createdAt', 'desc'),
    limit(pageSize + 1)
  )
  return onSnapshot(q, snap => {
    const docs = snap.docs.map(d => d.data() as FeedPost)
    const hasMore = docs.length > pageSize
    callback({ posts: hasMore ? docs.slice(0, pageSize) : docs, hasMore })
  })
}

/** Shoutouts a user has given / received — feeds the social achievements. */
export async function getShoutoutCounts(
  userId: string
): Promise<{ given: number; received: number }> {
  const [given, received] = await Promise.all([
    getDocs(query(
      feedCol(),
      where('type', '==', 'shoutout'),
      where('authorId', '==', userId),
      where('deleted', '==', false),
    )),
    getDocs(query(
      feedCol(),
      where('type', '==', 'shoutout'),
      where('targetUserId', '==', userId),
      where('deleted', '==', false),
    )),
  ])
  return { given: given.size, received: received.size }
}

// ─── Reactions ────────────────────────────────────────────────────────────────

export async function togglePostReaction(
  postId: string,
  emoji: string,
  userId: string,
  hasReacted: boolean
): Promise<void> {
  await updateDoc(doc(feedCol(), postId), {
    [`reactions.${emoji}`]: hasReacted ? arrayRemove(userId) : arrayUnion(userId),
  })
}

export async function toggleCommentReaction(
  postId: string,
  commentId: string,
  emoji: string,
  userId: string,
  hasReacted: boolean
): Promise<void> {
  await updateDoc(doc(commentsCol(postId), commentId), {
    [`reactions.${emoji}`]: hasReacted ? arrayRemove(userId) : arrayUnion(userId),
  })
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export const commentsCol = (postId: string) =>
  collection(db, 'feed', postId, 'comments')

export async function createComment(comment: FeedComment): Promise<void> {
  await setDoc(doc(commentsCol(comment.postId), comment.id), comment)
}

export async function softDeleteComment(postId: string, commentId: string): Promise<void> {
  await updateDoc(doc(commentsCol(postId), commentId), { deleted: true })
}

export function subscribeToComments(
  postId: string,
  callback: (comments: FeedComment[]) => void
) {
  const q = query(
    commentsCol(postId),
    where('deleted', '==', false),
    orderBy('createdAt', 'asc')
  )
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => d.data() as FeedComment))
  })
}

// ─── Bonus Logs ───────────────────────────────────────────────────────────────

export async function getBonusLog(
  challengeId: string,
  weekStartDate: string,
  userId: string
): Promise<BonusLog | null> {
  const snap = await getDoc(doc(bonusLogsCol(), bonusLogId(challengeId, weekStartDate, userId)))
  return snap.exists() ? (snap.data() as BonusLog) : null
}

export async function upsertBonusLog(log: BonusLog): Promise<void> {
  await setDoc(doc(bonusLogsCol(), log.id), stripUndefined(log))
}

/** All bonus logs for a user across challenges (Bonus Hunter achievement). */
export async function getUserBonusLogs(userId: string): Promise<BonusLog[]> {
  const q = query(bonusLogsCol(), where('userId', '==', userId))
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data() as BonusLog)
}

export function subscribeToWeekBonusLogs(
  challengeId: string,
  weekStartDate: string,
  callback: (logs: BonusLog[]) => void
) {
  const q = query(
    bonusLogsCol(),
    where('challengeId', '==', challengeId),
    where('weekStartDate', '==', weekStartDate)
  )
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => d.data() as BonusLog))
  })
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function createNotification(n: AppNotification): Promise<void> {
  await setDoc(doc(notificationsCol(n.userId), n.id), n)
}

export async function markNotificationRead(userId: string, notifId: string): Promise<void> {
  await updateDoc(doc(notificationsCol(userId), notifId), { read: true })
}

export function subscribeToNotifications(
  userId: string,
  callback: (notifs: AppNotification[]) => void
) {
  const q = query(
    notificationsCol(userId),
    where('read', '==', false),
    orderBy('createdAt', 'desc'),
    limit(50)
  )
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => d.data() as AppNotification))
  })
}
