// ─── Challenge Templates ──────────────────────────────────────────────────────
// Defined in shared/src/types.ts — re-exported here so app code importing
// from '@/types' continues to work unchanged.

export type { Exercise, ChallengeTemplate, DailyTarget } from '@f3-bedrock/shared'

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
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  morning:     { enabled: true, time: '08:00' },
  afternoon:   { enabled: true, time: '17:00' },
  evening:     { enabled: true, time: '20:00' },
  weeklyRecap: { enabled: true, time: '20:00', dayOfWeek: 0 },
  mentions:    true,
}

export interface AchievementBadge {
  challengeId: string
  type: 'completed' | 'participant'
  awardedAt: string // ISO
}

export interface User {
  id: string
  displayName: string // F3 name
  createdAt: string   // ISO
  fcmTokens?: string[]
  notificationPreferences: NotificationPreferences
  badges: AchievementBadge[]
  currentStreak: number
  longestStreak: number
}

// ─── Daily Logs ───────────────────────────────────────────────────────────────

export type CompletionFraction = 0 | 0.25 | 0.5 | 0.75 | 1

export interface ExerciseLog {
  exerciseId: string
  targetReps: number
  completedReps: number
}

export interface DailyLog {
  id: string              // Firestore doc id: {userId}_{YYYY-MM-DD}
  userId: string
  challengeId: string
  date: string            // YYYY-MM-DD
  completionFraction: CompletionFraction
  exerciseLogs: ExerciseLog[]
  modificationNote?: string
  isMakeUp: boolean
  notes?: string
  photoUrl?: string       // reserved for future
  loggedAt: string        // ISO
  updatedAt?: string      // ISO
}

// ─── Challenge Participation ──────────────────────────────────────────────────

export type ParticipationStatus = 'active' | 'opted-out' | 'modifying'

export interface ChallengeParticipation {
  id: string              // {userId}_{challengeId}
  userId: string
  challengeId: string
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
  content: string
  hashtags: string[]
  mentions: string[]      // user ids
  challengeId?: string
  targetUserId?: string   // shoutout recipient
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
  currentStreak: number
  todayComplete: boolean
  todayLog?: DailyLog
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

export type OnboardingStep =
  | 'welcome'
  | 'disclaimer'
  | 'profile'
  | 'past-challenges'
  | 'notifications'
  | 'pwa-install'
  | 'done'
