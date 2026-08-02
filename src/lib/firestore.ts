/**
 * Firestore collection paths and typed query helpers.
 * All write operations go through these helpers to ensure consistent document IDs.
 */

import {
  collection,
  collectionGroup,
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
import { DEFAULT_REGION_ID } from './challenges'
import type {
  User,
  DailyLog,
  FeedPost,
  FeedComment,
  AppNotification,
  ChallengeParticipation,
  BonusLog,
} from '@/types'

// ─── Ambient Region ───────────────────────────────────────────────────────────

/**
 * The region the browser session is currently in. RegionProvider keeps this in
 * sync; every create helper below stamps it onto new documents.
 *
 * Ambient rather than a parameter on ~15 call sites deliberately: a missed
 * parameter would silently write a region-less doc that then never appears in
 * its own region's feed. An explicit `regionId` already on the document always
 * wins, which is how any server-side caller stays correct — this module-level
 * value is only meaningful in the browser.
 */
let activeRegionId: string = DEFAULT_REGION_ID

/**
 * Set while a superadmin is previewing another region's app. Every write helper
 * below refuses, because the signed-in PAX belongs to a different region — a
 * log written in this state would be stamped with the region being *viewed*
 * and attributed to someone who isn't in it.
 *
 * The UI hides the controls too; this is the backstop that makes a missed one
 * fail loudly instead of quietly corrupting a leaderboard.
 */
let readOnly = false

export class ReadOnlyRegionError extends Error {
  constructor() {
    super("You're viewing another region — switch back to your own to log anything.")
    this.name = 'ReadOnlyRegionError'
  }
}

export function setRegionReadOnly(value: boolean): void {
  readOnly = value
}

function assertWritable(): void {
  if (readOnly) throw new ReadOnlyRegionError()
}

export function setActiveRegionId(regionId: string): void {
  activeRegionId = regionId
}

export function getActiveRegionId(): string {
  return activeRegionId
}

/** Stamps the active region onto a doc unless it already carries one. */
function withRegion<T extends { regionId?: string }>(doc: T): T {
  return doc.regionId ? doc : { ...doc, regionId: activeRegionId }
}

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

/**
 * Every PAX in a region. The roster is the chokepoint for region separation —
 * it drives the name picker, @mention autocomplete, callout modal, leaderboard
 * rows, and every group-completion denominator in the app.
 *
 * Docs written before regions existed are backfilled to 'bedrock' (see
 * scripts/backfill-regions.mjs), so an equality filter is safe.
 */
export async function getAllUsers(regionId: string): Promise<User[]> {
  const snap = await getDocs(query(usersCol(), where('regionId', '==', regionId)))
  return snap.docs.map(d => d.data() as User)
}

export async function upsertUser(user: User): Promise<void> {
  assertWritable()
  await setDoc(doc(usersCol(), user.id), withRegion(user), { merge: true })
}

export async function updateUser(userId: string, updates: Partial<User>): Promise<void> {
  assertWritable()
  await updateDoc(doc(usersCol(), userId), updates as Record<string, unknown>)
}

export async function setBadge(
  userId: string,
  badge: import('@/types').AchievementBadge,
  currentBadges: import('@/types').AchievementBadge[]
): Promise<void> {
  assertWritable()
  const filtered = currentBadges.filter(b => b.challengeId !== badge.challengeId)
  await updateDoc(doc(usersCol(), userId), { badges: [...filtered, badge] })
}

export async function clearPendingCelebration(userId: string): Promise<void> {
  await updateDoc(doc(usersCol(), userId), { pendingCelebration: deleteField() })
}

export function subscribeToUsers(regionId: string, callback: (users: User[]) => void) {
  return onSnapshot(query(usersCol(), where('regionId', '==', regionId)), snap => {
    callback(snap.docs.map(d => d.data() as User))
  })
}

// ─── Daily Logs ───────────────────────────────────────────────────────────────

export async function getDailyLog(userId: string, date: string): Promise<DailyLog | null> {
  const snap = await getDoc(doc(dailyLogsCol(), dailyLogId(userId, date)))
  return snap.exists() ? (snap.data() as DailyLog) : null
}

export async function upsertDailyLog(log: DailyLog): Promise<void> {
  assertWritable()
  await setDoc(doc(dailyLogsCol(), log.id), withRegion(log), { merge: true })
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
 * All logs for a challenge across a date range, inclusive. Powers the "who has
 * hit this week's target" count on weekly-cumulative challenges, where a single
 * day's logs can't tell you who's done.
 */
export async function getLogsForDateRange(
  challengeId: string,
  startDate: string,
  endDate: string,
): Promise<DailyLog[]> {
  const q = query(
    dailyLogsCol(),
    where('challengeId', '==', challengeId),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
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
  assertWritable()
  await setDoc(doc(participationCol(), p.id), withRegion(p), { merge: true })
}

export async function getChallengeParticipants(challengeId: string): Promise<ChallengeParticipation[]> {
  const q = query(participationCol(), where('challengeId', '==', challengeId))
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data() as ChallengeParticipation)
}

export async function getUserParticipations(userId: string): Promise<ChallengeParticipation[]> {
  const q = query(participationCol(), where('userId', '==', userId))
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data() as ChallengeParticipation)
}

// ─── Feed ─────────────────────────────────────────────────────────────────────

export async function createFeedPost(post: FeedPost): Promise<void> {
  assertWritable()
  await setDoc(doc(feedCol(), post.id), stripUndefined(withRegion(post)))
}

/** Creates a feed post only if a doc with that ID doesn't already exist. */
export async function createFeedPostOnce(post: FeedPost): Promise<void> {
  assertWritable()
  const ref = doc(feedCol(), post.id)
  const snap = await getDoc(ref)
  if (snap.exists()) return
  await setDoc(ref, withRegion(post))
}

export async function updateFeedPost(postId: string, updates: Partial<FeedPost>): Promise<void> {
  assertWritable()
  await updateDoc(doc(feedCol(), postId), stripUndefined({ ...updates, updatedAt: new Date().toISOString() }))
}

export async function softDeletePost(postId: string): Promise<void> {
  assertWritable()
  await updateDoc(doc(feedCol(), postId), { deleted: true })
}

/**
 * Live feed listener over a growing window, scoped to one region. The feed is
 * the only collection with no challenge filter, so `regionId` is what actually
 * keeps two regions' feeds apart.
 *
 * `pageSize` is the number of posts
 * currently shown; the query fetches one extra doc so the caller can tell
 * whether older posts exist (infinite-scroll trigger). Re-subscribe with a
 * larger `pageSize` to load more — the newest page stays real-time throughout.
 */
export function subscribeToFeed(
  regionId: string,
  callback: (result: { posts: FeedPost[]; hasMore: boolean }) => void,
  pageSize = 30
) {
  const q = query(
    feedCol(),
    where('regionId', '==', regionId),
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

export interface SocialStats {
  /** Outgoing shoutout posts (docs, for Shot Caller's date/target join). */
  givenShoutouts: FeedPost[]
  shoutoutsReceived: number
  commentsPosted: number
  /** Cumulative photos this user has attached across their feed posts. */
  photosUploaded: number
  /** Cumulative videos this user has attached across their feed posts. */
  videosUploaded: number
}

/** Social activity powering the social achievements. */
export async function getSocialStats(userId: string): Promise<SocialStats> {
  // allSettled so one failing query (e.g. a missing index or rule on a single
  // collection) degrades just that stat to its default instead of wiping out
  // every social badge at once.
  const [given, received, comments, posts] = await Promise.allSettled([
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
    // Single-field collection-group query (index in firestore.indexes.json,
    // rule in firestore.rules); deleted is filtered client-side to avoid
    // needing a composite index.
    getDocs(query(collectionGroup(db, 'comments'), where('authorId', '==', userId))),
    // All of the user's live posts — powers the photo/video media badges.
    // Equality-only filters need no composite index.
    getDocs(query(
      feedCol(),
      where('authorId', '==', userId),
      where('deleted', '==', false),
    )),
  ])
  const authoredPosts = posts.status === 'fulfilled'
    ? posts.value.docs.map(d => d.data() as FeedPost)
    : []
  return {
    givenShoutouts: given.status === 'fulfilled'
      ? given.value.docs.map(d => d.data() as FeedPost)
      : [],
    shoutoutsReceived: received.status === 'fulfilled' ? received.value.size : 0,
    commentsPosted: comments.status === 'fulfilled'
      ? comments.value.docs.filter(d => !(d.data() as FeedComment).deleted).length
      : 0,
    photosUploaded: authoredPosts.reduce((n, p) => n + (p.imageUrls?.length ?? 0), 0),
    videosUploaded: authoredPosts.reduce((n, p) => n + (p.videoUrls?.length ?? 0), 0),
  }
}

/**
 * Most-recent shoutout timestamp per recipient → `Map<userId, ISO createdAt>`.
 * One equality-only query (no composite index) folded down client-side, so the
 * leaderboard's "Who needs a push?" ranking can factor in who's been getting
 * love lately and who's been overlooked. Users with no shoutout are absent.
 *
 * Region-scoped for cost, not correctness — the only caller looks it up for PAX
 * already on the region's roster — but unscoped, every region pays to read
 * every other region's shoutouts.
 */
export async function getLatestShoutoutsByUser(regionId: string): Promise<Map<string, string>> {
  const snap = await getDocs(query(
    feedCol(),
    where('regionId', '==', regionId),
    where('type', '==', 'shoutout'),
    where('deleted', '==', false),
  ))
  const latest = new Map<string, string>()
  for (const d of snap.docs) {
    const post = d.data() as FeedPost
    if (!post.targetUserId) continue
    const prev = latest.get(post.targetUserId)
    if (!prev || post.createdAt > prev) latest.set(post.targetUserId, post.createdAt)
  }
  return latest
}

// ─── Reactions ────────────────────────────────────────────────────────────────

export async function togglePostReaction(
  postId: string,
  emoji: string,
  userId: string,
  hasReacted: boolean
): Promise<void> {
  assertWritable()
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
  assertWritable()
  await updateDoc(doc(commentsCol(postId), commentId), {
    [`reactions.${emoji}`]: hasReacted ? arrayRemove(userId) : arrayUnion(userId),
  })
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export const commentsCol = (postId: string) =>
  collection(db, 'feed', postId, 'comments')

export async function createComment(comment: FeedComment): Promise<void> {
  assertWritable()
  await setDoc(doc(commentsCol(comment.postId), comment.id), comment)
}

export async function softDeleteComment(postId: string, commentId: string): Promise<void> {
  assertWritable()
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
  assertWritable()
  await setDoc(doc(bonusLogsCol(), log.id), stripUndefined(withRegion(log)))
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
