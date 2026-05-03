// ─── Challenge Types ──────────────────────────────────────────────────────────
// Source of truth for challenge-related types — used by both the Next.js app
// (via re-export from src/types/index.ts) and Cloud Functions (direct import).

export type ExerciseUnit = 'reps' | 'seconds'

export interface Exercise {
  id: string
  name: string
  shortName: string
  unit?: ExerciseUnit // default 'reps'
}

// For 'weekly-tiers' challenges: each tier covers a day range with per-exercise amounts.
export interface WeekTier {
  startDay: number // 1-based day within the challenge
  endDay: number
  targets: Array<{ exerciseId: string; amount: number }>
}

export type ConditionalRestCondition = 'logged-previous-day'

// A rest date whose exemption depends on a machine-checkable condition.
export interface ConditionalRestDate {
  date: string
  conditionLabel: string           // UI copy, e.g. "Did you do the Murph yesterday?"
  conditionType: ConditionalRestCondition
}

export interface ChallengeTemplate {
  id: string
  name: string
  hashtag: string
  tagline: string
  month: number // 1–12
  year: number
  exercises: Exercise[]

  // Challenge computation type — defaults to 'escalating' for backward compat
  type?: 'escalating' | 'weekly-tiers'

  // 'escalating': total reps for day N = N * dailyMultiplier, split equally across exercises
  dailyMultiplier?: number

  // 'weekly-tiers': fixed targets per exercise per week tier
  weeklyTiers?: WeekTier[]

  // Days that do not need to be logged and do not break streaks
  restDates?: string[]              // fixed rest days (e.g. holidays)
  conditionalRestDates?: ConditionalRestDate[] // optional rest days (PAX decides)

  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD

  // Per-challenge copy overrides — augments the generic defaults in copy.ts
  copy?: ChallengeTemplateCopy
}

// ─── Copy / Template Types ────────────────────────────────────────────────────
// Defined here (not copy.ts) to avoid circular imports: ChallengeTemplate → copy.

export interface FeedPostVars {
  name: string
  day: number
  totalDays: number
  totalReps: number
  exerciseCount: number
  hashtag: string
  challengeName: string
  exerciseName: string
  daysLeft: number
  percent: number
  weekNumber?: number
}

export interface NotificationVars {
  fn: string
  dayNumber: number
  totalDays: number
  daysRemaining: number
  repsRemaining: number
  challengeName: string
}

export interface NotificationTemplatePair {
  titles: string[]
  bodies: string[]
}

export interface ChallengeTemplateCopy {
  welcomeTagline?: string

  feedPost?: {
    day1?: string[]
    quarter?: string[]
    half?: string[]
    threeQuarter?: string[]
    makeUp?: string[]
    regular?: string[]
    regularLate?: string[]
  }

  notification?: {
    day1Completed?: NotificationTemplatePair
    day1Pending?: NotificationTemplatePair
    quarterCompleted?: NotificationTemplatePair
    quarterPending?: NotificationTemplatePair
    halfCompleted?: NotificationTemplatePair
    halfPending?: NotificationTemplatePair
    threeQuarterCompleted?: NotificationTemplatePair
    threeQuarterPending?: NotificationTemplatePair
  }
}

export interface DailyTarget {
  date: string // YYYY-MM-DD
  day: number  // 1-based day of challenge
  isRestDay: boolean
  isConditionalRestDay?: boolean
  conditionalRestLabel?: string
  totalReps: number        // sum of rep-type targets; 0 on rest days
  repsPerExercise: number  // first rep-type target for notification copy; 0 on rest days
  exercises: Array<{ exercise: Exercise; reps: number }> // reps = amount regardless of unit
}
