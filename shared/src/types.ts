// ─── Challenge Types ──────────────────────────────────────────────────────────
// Source of truth for challenge-related types — used by both the Next.js app
// (via re-export from src/types/index.ts) and Cloud Functions (direct import).

export type ExerciseUnit = 'reps' | 'seconds'

export interface Exercise {
  id: string
  name: string
  shortName: string
  unit?: ExerciseUnit // default 'reps'
  // Lowercased plural for message copy, e.g. 'LBCs'. Defaults to a
  // pluralized lowercase `name` (see remaining.ts exercisePlural).
  plural?: string
  // Custom encouragement lines shown when this exercise is the last one
  // standing today. Supports {remaining} (amount left) and {name} (plural).
  encouragements?: string[]
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

export interface BonusChallengeWeek {
  startDate: string          // YYYY-MM-DD
  endDate: string            // YYYY-MM-DD
  description: string        // what PAX should do this week
  feedPostTemplates?: string[] // completion post variants; supports {name} and {hashtag}
}

export interface BonusChallenge {
  name: string
  weeks: BonusChallengeWeek[]
}

// A signature achievement that ships with a specific challenge — defined as
// data here, turned into a full AchievementDefinition by achievements.ts.
export interface ChallengeBadgeDef {
  id: string // globally unique, e.g. 'jul-2026-machine'
  name: string
  emoji: string
  description: string
  howTo: string
  criteria:
    | { type: 'complete-challenge' }              // every required day (makeups count)
    | { type: 'complete-days'; days: number }     // N fully completed days
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

  // Optional bonus challenge with weekly segments displayed alongside the main challenge
  bonusChallenge?: BonusChallenge

  // Signature achievements that ship with this challenge (see ChallengeBadgeDef)
  badges?: ChallengeBadgeDef[]

  // Badge of the Month: featured achievement id — pinned on the home
  // Next Badge card and unlocked with extra fanfare
  featuredBadgeId?: string

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
  // Set only for the `stacked` section — full days finished today, including
  // this one.
  stackedDays?: number
  // Set only for the `comeback` section — required days missed before today.
  daysAway?: number
}

export interface NotificationVars {
  fn: string
  dayNumber: number
  totalDays: number
  daysRemaining: number
  repsRemaining: number
  challengeName: string
  // Exercise-aware phrase for what's left today, e.g. "20 incline merkins
  // and 20 decline merkins" — see remaining.ts formatRemainingWork.
  workRemaining?: string
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
    // 2nd+ full day finished in the same calendar day
    stacked?: string[]
    // first day back after 3+ required days missed
    comeback?: string[]
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
