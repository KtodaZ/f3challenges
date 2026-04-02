// ─── Challenge Templates ──────────────────────────────────────────────────────

export interface Exercise {
  id: string
  name: string
  shortName: string
}

export interface ChallengeTemplate {
  id: string
  name: string
  hashtag: string
  tagline: string
  month: number // 1–12
  year: number
  exercises: Exercise[]
  /** Total reps for the day = day * dailyMultiplier (day is 1-based) */
  dailyMultiplier: number
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
}

export interface DailyTarget {
  date: string // YYYY-MM-DD
  day: number  // 1-based day of challenge
  totalReps: number
  repsPerExercise: number
  exercises: Array<{ exercise: Exercise; reps: number }>
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
  fcmToken?: string
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
  createdAt: string       // ISO
  updatedAt?: string      // ISO
  deleted: boolean
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'mention'
  | 'shoutout'
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
