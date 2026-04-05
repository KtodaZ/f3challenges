// ─── Challenge Types ──────────────────────────────────────────────────────────
// Source of truth for challenge-related types — used by both the Next.js app
// (via re-export from src/types/index.ts) and Cloud Functions (direct import).

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
