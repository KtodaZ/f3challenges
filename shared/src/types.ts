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
  // No external load possible (chin-ups, dips). The weight picker offers "BW"
  // only and the leaderboard load badge stays quiet for these.
  bodyweight?: boolean
  // How many implements this variation uses: 2 for a pair of dumbbells
  // ("2×25"), 1 for a single coupon carried in both hands ("1×60"). Defaults
  // to 2, and ignored when bodyweight. The variation already answers this, so
  // the log pad never asks — it just stamps this onto the weight.
  loadHands?: 1 | 2
}

// For 'weekly-tiers' challenges: each tier covers a day range with per-exercise amounts.
export interface WeekTier {
  startDay: number // 1-based day within the challenge
  endDay: number
  targets: Array<{ exerciseId: string; amount: number }>
}

// ─── Weekly-cumulative weeks ──────────────────────────────────────────────────
// For 'weekly-cumulative' challenges: one pooled rep target per calendar week,
// filled by any mix of the challenge's exercises. Weeks are listed explicitly
// rather than derived so a challenge can open or close mid-week with a
// prorated target (August 2026 starts on a Saturday: a 1-day week worth 50)
// and so a future challenge can escalate its weekly target week over week
// without any code change.
export interface ChallengeWeek {
  startDate: string // YYYY-MM-DD, inclusive
  endDate: string   // YYYY-MM-DD, inclusive
  target: number    // pooled reps for the week
  /** Optional override for the card header; defaults to "Week {n}". */
  label?: string
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

/**
 * What a challenge badge asks for. Every variant is pure data so a new
 * challenge can ship its own badges without touching the engine — add a case
 * here plus its progress rule in achievements.ts and every future challenge
 * gets it for free.
 */
export type ChallengeBadgeCriteria =
  /** The whole challenge: every required day, or every week on a
   *  weekly-cumulative challenge. Make-ups count. */
  | { type: 'complete-challenge' }
  /** N fully completed days. */
  | { type: 'complete-days'; days: number }
  /** N reps banked across the challenge, any exercise. */
  | { type: 'challenge-reps'; reps: number }
  /** N reps of one specific exercise across the challenge. */
  | { type: 'exercise-reps'; exerciseId: string; reps: number }
  /** N reps inside a single day. */
  | { type: 'single-day-reps'; reps: number }
  /** N weekly targets hit (weekly-cumulative only). */
  | { type: 'weeks-completed'; weeks: number }
  /** Every one of the challenge's exercises logged inside one week. */
  | { type: 'week-variety' }
  /** N pounds moved across the challenge: reps × weight, summed. Unweighted
   *  sets count zero, so this only exists on challenges that log a weight. */
  | { type: 'volume-lbs'; lbs: number }
  /** N reps done at or above a weight, counted on total pounds in play — a
   *  pair of 20s and a single 40 lb coupon both clear a 40 lb bar. */
  | { type: 'reps-at-or-above'; lbs: number; reps: number }
  /** Hit a week's target with at least this many days still on the clock. */
  | { type: 'week-early'; daysEarly: number }

// A signature achievement that ships with a specific challenge — defined as
// data here, turned into a full AchievementDefinition by achievements.ts.
export interface ChallengeBadgeDef {
  id: string // globally unique, e.g. 'jul-2026-machine'
  name: string
  emoji: string
  description: string
  howTo: string
  criteria: ChallengeBadgeCriteria
  /** Noun for near-miss copy ("2 reps away"). Defaults per criteria type. */
  unitLabel?: string
}

export interface ChallengeTemplate {
  id: string
  name: string
  hashtag: string
  tagline: string
  month: number // 1–12
  year: number
  exercises: Exercise[]

  // Regions running this challenge. Absent means Bedrock-only, which keeps
  // every pre-multi-region challenge correct without editing it. Listing more
  // than one region shares the same challenge across them — they still get
  // separate leaderboards and feeds.
  regionIds?: string[]

  // Challenge computation type — defaults to 'escalating' for backward compat
  type?: 'escalating' | 'weekly-tiers' | 'weekly-cumulative'

  // 'escalating': total reps for day N = N * dailyMultiplier, split equally across exercises
  dailyMultiplier?: number

  // 'weekly-tiers': fixed targets per exercise per week tier
  weeklyTiers?: WeekTier[]

  // 'weekly-cumulative': one pooled rep target per week, no daily quota.
  // Reps count toward the week regardless of which exercise they came from.
  weeks?: ChallengeWeek[]

  // Day the challenge's week rolls over: 0=Sunday (default) … 6=Saturday.
  // Shared by the weekly leaderboard, the week card, and the Cloud Functions
  // so the app and the push queue can never disagree about which week it is.
  weekStartsOn?: number

  // How-to-run-it bullets shown on the home screen and in onboarding.
  // Free-form coaching notes; rendered verbatim, in order.
  guidance?: string[]

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

  // Re-skins the 🎖️/🥉/🥈/🥇 trophy ladder for this challenge only — so a
  // themed month can hand out "Gold Bicep 🥇💪" without renaming the trophies
  // on every other challenge. Any tier left out keeps the standard look.
  trophyStyle?: {
    emoji?: Partial<Record<'participant' | 'bronze' | 'silver' | 'gold', string>>
    label?: Partial<Record<'participant' | 'bronze' | 'silver' | 'gold', string>>
    /** Public path to real artwork for a tier, e.g.
     *  '/challenges/aug-2026/bicep-gold.png'. Used only where the mark renders
     *  large enough to read (trophy case, detail, celebrations) — small chips
     *  stay on emoji, where a downscaled illustration turns to mush. Always
     *  falls back to `emoji` if the file is missing or fails to load. */
    iconUrl?: Partial<Record<'participant' | 'bronze' | 'silver' | 'gold', string>>
  }

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
  /** True on 'weekly-cumulative' challenges: there is no daily quota, so
   *  `totalReps` is 0 and nothing should render a "% of today" figure. Callers
   *  that show daily progress must branch on this and use WeekProgress. */
  isOpenEnded?: boolean
}

// ─── Load (weight used) ───────────────────────────────────────────────────────
// A weight belongs to a set, not to a day: 2×20 with dumbbells on Monday and
// 1×40 with a coupon on Tuesday are both true, and so is doing both in one
// morning. See LoggedSet — the day-level `load` on a DailyLog is a rollup of
// the sets underneath it, kept so older readers stay correct.

export interface ExerciseLoad {
  /** Pounds per hand (or total, for a coupon). Omitted for bodyweight-only work. */
  lbs?: number
  /** Implements: 2 = a pair of dumbbells, 1 = a single coupon. Stamped from the
   *  variation's `loadHands`, never asked. */
  hands?: 1 | 2
  /** True when the work was bodyweight (chin-ups) — renders as "BW". */
  bodyweight?: boolean
}

/**
 * One tap of the log pad: some reps of one variation at one weight.
 *
 * The pad was always producing these — every "+20" is a set — it just summed
 * them away on the spot, which is why a day could only carry a single weight.
 * Keeping them makes "2×20 dumbbells today, 1×40 coupon tomorrow" (or both
 * before coffee) representable, and makes volume computable.
 *
 * Reps still score as reps: 25 reps at 2×20 is 25 toward the week, never 50.
 * Weight is a badge and a volume stat, never a multiplier.
 */
export interface LoggedSet {
  exerciseId: string
  reps: number
  /** Absent for bodyweight work, or when the PAX never set one. */
  load?: ExerciseLoad
  /** ISO timestamp. Doubles as the set's identity — undo pops by it, and it's
   *  what keeps two identical sets logged seconds apart from collapsing into
   *  one under Firestore's arrayUnion. */
  at: string
}

// ─── Weekly-cumulative progress ───────────────────────────────────────────────

/** A challenge week resolved against the calendar, with its position. */
export interface ResolvedWeek extends ChallengeWeek {
  /** 1-based index within the challenge. */
  index: number
  /** Calendar days the week spans (1–7). */
  dayCount: number
}

/** Where a PAX stands inside one week of a 'weekly-cumulative' challenge. */
export interface WeekProgress {
  week: ResolvedWeek
  /** Reps banked this week across every exercise. */
  reps: number
  target: number
  /** reps / target, capped at 1. */
  fraction: number
  /** Reps still owed (0 once the target is hit). */
  remaining: number
  /** Days of the week still available, today included. 0 once the week ends. */
  daysLeft: number
  /** Reps/day needed across `daysLeft` to finish. 0 when already done. */
  perDayNeeded: number
  /** True once `reps >= target`. */
  isComplete: boolean
}
