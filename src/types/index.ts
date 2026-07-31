// ─── Challenge Templates ──────────────────────────────────────────────────────
// Defined in shared/src/types.ts — re-exported here so app code importing
// from '@/types' continues to work unchanged.

export type {
  Region,
  ExerciseUnit, Exercise, ChallengeTemplate, DailyTarget, WeekTier, ConditionalRestDate,
  ChallengeTemplateCopy, FeedPostVars, NotificationVars, NotificationTemplatePair,
  BonusChallenge, BonusChallengeWeek,
  ChallengeWeek, ResolvedWeek, WeekProgress, ExerciseLoad,
  TrophyUnit, TrophyUnitInfo,
  AchievementLogInput, AchievementContext, EarnedAchievement,
  AchievementCategory, CelebrationTheme, AchievementProgress,
  AchievementDefinition, AchievementEvaluation,
  TrophyTier, TrophyTierDef, TrophyProgress, TrophyNudge,
} from '@f3-bedrock/shared'

// ─── Bonus Logs ───────────────────────────────────────────────────────────────

export interface BonusLog {
  id: string            // `{challengeId}_{weekStartDate}_{userId}`
  challengeId: string
  /** Denormalized — see the note on DailyLog.regionId. */
  regionId?: string
  weekStartDate: string // YYYY-MM-DD — the bonus week's startDate, acts as week key
  userId: string
  completedAt: string   // ISO timestamp
  isMakeUp?: boolean    // true when completed after the week ended (via Catch Up)
}

// ─── Users ────────────────────────────────────────────────────────────────────

export interface NotificationWindow {
  enabled: boolean
  time: string // "HH:MM" in user's local time (all PT)
}

export interface NotificationPreferences {
  morning: NotificationWindow
  afternoon: NotificationWindow
  evening: NotificationWindow
  weeklyRecap: NotificationWindow & { dayOfWeek: number } // 0=Sun
  mentions: boolean
  /** Opt-in: competitive, rank-based nudges layered onto the time-of-day
   *  reminders ("Milkman just passed you — 100 reps to retake #3"). Off by
   *  default; only ever turned on by an explicit choice. */
  competitive: boolean
  /** True once the PAX has been asked about competitive notifications (in
   *  onboarding, settings, or the leaderboard prompt). Absent = never asked,
   *  which is what triggers the one-time leaderboard opt-in modal. */
  competitivePrompted?: boolean
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  morning:     { enabled: true, time: '08:00' },
  afternoon:   { enabled: true, time: '17:00' },
  evening:     { enabled: true, time: '20:00' },
  weeklyRecap: { enabled: true, time: '20:00', dayOfWeek: 0 },
  mentions:    true,
  competitive: false,
}

export interface AchievementBadge {
  challengeId: string
  /** Legacy shape, still written so older clients keep rendering something
   *  sensible. `tier` is the real value — see shared/src/trophies.ts. */
  type: 'completed' | 'participant'
  /** 🎖️ / 🥉 / 🥈 / 🥇. Absent on badges awarded before tiers existed;
   *  resolveBadgeTier() maps those (completed → gold, participant → silver). */
  tier?: import('@f3-bedrock/shared').TrophyTier
  awardedAt: string // ISO
}

export interface User {
  id: string
  displayName: string // F3 name
  /** Which F3 region this PAX belongs to (see shared/src/regions.ts). Optional
   *  on the type so docs written before the backfill still parse; every read
   *  path funnels through resolveRegion()/DEFAULT_REGION_ID, and every write
   *  path sets it. */
  regionId?: string
  createdAt: string   // ISO
  fcmTokens?: string[]
  notificationPreferences: NotificationPreferences
  badges: AchievementBadge[]
  /** Gamification achievements (trophy case) — see shared/src/achievements.ts */
  achievements?: import('@f3-bedrock/shared').EarnedAchievement[]
  currentStreak: number
  longestStreak: number
  /** ISO timestamp of when this PAX claimed their account on the new domain.
   *  Set by the claim link; the old origin reads it as the signal to retire its
   *  own push registration so both installs don't notify. See lib/migration.ts. */
  migratedAt?: string
  pendingCelebration?: {
    challengeId: string
    badgeType?: 'completed' | 'participant'
    tier?: import('@f3-bedrock/shared').TrophyTier
  }
}

// ─── Daily Logs ───────────────────────────────────────────────────────────────

/**
 * Day completion as a precise 0–1 fraction of reps done — the amount completed
 * across all of the day's exercises over the amount targeted (each exercise
 * capped at its target). 1 means every rep is in. No longer snapped to quarters.
 */
export type CompletionFraction = number

export interface ExerciseLog {
  exerciseId: string
  targetReps: number
  completedReps: number
}

export interface DailyLog {
  id: string              // Firestore doc id: {userId}_{YYYY-MM-DD}
  userId: string
  challengeId: string
  /** Denormalized from the author. Not queried today — challengeId already
   *  partitions logs by region while regions run separate challenges — but
   *  written now so a shared inter-regional challenge doesn't need a migration. */
  regionId?: string
  date: string            // YYYY-MM-DD
  /** On day-based challenges: share of today's target completed.
   *  On 'weekly-cumulative' challenges there is no daily target, so this is
   *  simply 1 when any reps were logged and 0 otherwise — "did you train
   *  today". Week completion lives in WeekProgress, derived from these logs. */
  completionFraction: CompletionFraction
  exerciseLogs: ExerciseLog[]
  /** Optional weight used for this session. Purely for bragging rights —
   *  never affects scoring. See ExerciseLoad. */
  load?: import('@f3-bedrock/shared').ExerciseLoad
  modificationNote?: string
  isMakeUp: boolean
  notes?: string
  photoUrl?: string       // reserved for future
  loggedAt: string        // ISO — first write for this day
  updatedAt?: string      // ISO — last write
  completedAt?: string    // ISO — when the day first hit 100% (first-finisher badge)
}

// ─── Challenge Participation ──────────────────────────────────────────────────

export type ParticipationStatus = 'active' | 'opted-out' | 'modifying'

export interface ChallengeParticipation {
  id: string              // {userId}_{challengeId}
  userId: string
  challengeId: string
  /** Denormalized — see the note on DailyLog.regionId. */
  regionId?: string
  status: ParticipationStatus
  optOutReason?: string
  modificationNote?: string
  joinedAt: string        // ISO
  updatedAt?: string      // ISO
}

// ─── Feed ─────────────────────────────────────────────────────────────────────

export type FeedPostType = 'post' | 'shoutout' | 'system'

export interface FeedPost {
  id: string
  type: FeedPostType
  authorId: string
  /** Region whose feed this post belongs to. Unlike logs, the feed has no
   *  challenge filter — this is what actually keeps the two regions' feeds
   *  apart, so it is queried. */
  regionId?: string
  content: string
  hashtags: string[]
  mentions: string[]      // user ids
  challengeId?: string
  targetUserId?: string   // shoutout recipient
  imageUrls?: string[]    // attached photos (Firebase Storage), ordered
  videoUrls?: string[]    // attached videos (Firebase Storage), ordered
  reactions?: Record<string, string[]>  // emoji → userId[]
  createdAt: string       // ISO
  updatedAt?: string      // ISO
  deleted: boolean
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export interface FeedComment {
  id: string
  postId: string
  parentCommentId?: string  // if set, this is a reply (max depth 2)
  authorId: string
  content: string
  reactions?: Record<string, string[]>  // emoji → userId[]
  createdAt: string         // ISO
  deleted: boolean
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'mention'
  | 'shoutout'
  | 'comment'
  | 'reply'
  | 'daily_reminder'
  | 'weekly_recap'
  | 'system'

export interface AppNotification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  read: boolean
  createdAt: string       // ISO
  relatedPostId?: string
  relatedUserId?: string
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  user: User
  participation?: ChallengeParticipation
  completedDays: number
  totalDays: number
  completionPct: number
  totalReps: number
  currentStreak: number
  todayComplete: boolean
  todayLog?: DailyLog
  /** Most recent day (YYYY-MM-DD) this PAX logged any reps in the challenge.
   *  Drives the "hasn't done a rep in N days" push-priority signal. */
  lastActiveDate?: string
  /** ISO timestamp of the most recent shoutout this PAX *received*, if any.
   *  Lets the push queue spread the love — recently celebrated PAX rank lower. */
  lastShoutoutAt?: string
  /** Most recent weight this PAX logged — rendered as the load badge. */
  load?: import('@f3-bedrock/shared').ExerciseLoad
  /** Set on 'weekly-cumulative' challenges: where they stand in the current
   *  week. The row shows this instead of a "done today" badge, because on
   *  these challenges a skipped day is allowed and a short week is not. */
  week?: import('@f3-bedrock/shared').WeekProgress
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

export type OnboardingStep =
  | 'welcome'
  | 'region'
  | 'disclaimer'
  | 'profile'
  | 'notifications'
  | 'pwa-install'
  | 'done'
