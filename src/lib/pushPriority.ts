/**
 * "Who needs a push?" ranking + descriptions.
 *
 * Turns a LeaderboardEntry into a single human-readable reason line plus a
 * numeric priority score, so the leaderboard can rank PAX by who most needs a
 * nudge today — not just list everyone who isn't finished.
 *
 * The score is a weighted blend of several signals:
 *   - Inactivity     — how many days since their last logged rep (dominant).
 *   - Today's status — not started > barely started > partway > almost done.
 *   - Social neglect — how long since they last *received* a shoutout.
 *   - Streak at risk — an active streak that breaks if today stays blank.
 * Higher score = push them first. The description surfaces the single most
 * salient reason; the score folds in the rest.
 */
import type { LeaderboardEntry } from '@/types'
import { pacificDayKey } from './utils'

export type PushTone =
  | 'close'    // almost done today
  | 'progress' // partway through today
  | 'early'    // barely started today
  | 'streak'   // active streak on the line
  | 'idle'     // active yesterday, blank today
  | 'cold'     // multiple days quiet
  | 'never'    // no reps at all this month

export type PushUrgency = 'high' | 'med' | 'low'

export interface PushReason {
  /** Primary one-line description shown under the PAX's name. */
  text: string
  /** Optional muted secondary note (e.g. long since a shoutout). */
  secondary?: string
  tone: PushTone
  /** Weighted priority — higher means "push this PAX first". */
  score: number
  urgency: PushUrgency
}

/** Whole calendar days from one YYYY-MM-DD to another (b - a). */
function daysBetween(from: string, to: string): number {
  const a = new Date(from + 'T00:00:00').getTime()
  const b = new Date(to + 'T00:00:00').getTime()
  return Math.round((b - a) / 86_400_000)
}

/** Deterministic per-PAX pick so wording varies between people but is stable
 *  across renders for the same person (no flicker on refresh). */
function pick(seed: string, variants: string[]): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return variants[h % variants.length]
}

/** Fraction (0–1) of today's target reps this PAX has logged so far. */
function todayFraction(entry: LeaderboardEntry): number {
  const log = entry.todayLog
  if (!log) return 0
  const target = log.exerciseLogs.reduce((s, e) => s + e.targetReps, 0)
  const done = log.exerciseLogs.reduce((s, e) => s + e.completedReps, 0)
  return target > 0 ? done / target : log.completionFraction
}

export function getPushReason(entry: LeaderboardEntry, today: string): PushReason {
  const id = entry.user.id

  const todayFrac = todayFraction(entry)
  const startedToday = todayFrac > 0
  // Clamp so an in-progress PAX never reads "0%" or a rounding "100%".
  const pct = Math.min(99, Math.max(1, Math.round(todayFrac * 100)))

  const everLogged = entry.totalReps > 0 || entry.completedDays > 0
  const daysSinceActive = entry.lastActiveDate
    ? daysBetween(entry.lastActiveDate, today)
    : undefined
  const daysSinceShoutout = entry.lastShoutoutAt
    ? daysBetween(pacificDayKey(entry.lastShoutoutAt), today)
    : undefined
  const streak = entry.currentStreak

  // ─── Weighted priority score ────────────────────────────────────────────
  let score = 0

  // Inactivity — the loudest signal.
  if (!everLogged) score += 55
  else if (startedToday) score += 0
  else if (daysSinceActive === undefined) score += 40
  else if (daysSinceActive >= 4) score += 60
  else if (daysSinceActive === 3) score += 45
  else if (daysSinceActive === 2) score += 30
  else if (daysSinceActive === 1) score += 12

  // Today's progress — completion vs partial vs untouched.
  if (!startedToday) score += 20
  else if (todayFrac < 0.25) score += 14
  else if (todayFrac < 0.5) score += 10
  else if (todayFrac < 0.75) score += 6
  else score += 2

  // Social neglect — spread shoutouts around; ease off the recently celebrated.
  if (daysSinceShoutout === undefined) score += everLogged ? 12 : 0
  else if (daysSinceShoutout >= 14) score += 16
  else if (daysSinceShoutout >= 7) score += 10
  else if (daysSinceShoutout >= 3) score += 5

  // Streak at risk — only meaningful when today is still blank.
  if (!startedToday && streak >= 1) {
    if (streak >= 7) score += 15
    else if (streak >= 3) score += 9
    else score += 4
  }

  const urgency: PushUrgency = score >= 55 ? 'high' : score >= 30 ? 'med' : 'low'

  // ─── Primary description ────────────────────────────────────────────────
  let tone: PushTone
  let text: string

  if (startedToday) {
    if (todayFrac >= 0.75) {
      tone = 'close'
      text = pick(id, [
        `Almost done today — ${pct}% of the way there`,
        `So close — ${pct}% done, just needs the finish`,
        `${pct}% there today. One more set!`,
      ])
    } else if (todayFrac >= 0.5) {
      tone = 'progress'
      text = pick(id, [
        `Past halfway today — ${pct}% in`,
        `${pct}% through today's reps`,
        `Halfway home — ${pct}% done today`,
      ])
    } else if (todayFrac >= 0.25) {
      tone = 'early'
      text = pick(id, [
        `Off the mark today — ${pct}% done`,
        `${pct}% into today, needs a nudge to keep rolling`,
      ])
    } else {
      tone = 'early'
      text = pick(id, [
        `Just getting started — ${pct}% done today`,
        `Barely cracked today — ${pct}% in`,
      ])
    }
  } else if (!everLogged) {
    tone = 'never'
    text = pick(id, [
      `Hasn't logged a single rep this month`,
      `Still on the sidelines — no reps yet this month`,
      `Yet to get in the game this month`,
    ])
  } else if (daysSinceActive !== undefined && daysSinceActive >= 2) {
    tone = 'cold'
    text = pick(id, [
      `Hasn't done a rep in ${daysSinceActive} days`,
      `${daysSinceActive} days quiet — time for a call-out`,
      `Gone dark for ${daysSinceActive} days`,
    ])
  } else if (streak >= 2) {
    // Active yesterday, blank today, on a real streak.
    tone = 'streak'
    text = pick(id, [
      `${streak}-day streak on the line — nothing logged today`,
      `Riding a ${streak}-day streak, but today's still blank`,
      `${streak} days straight — don't let today break it`,
    ])
  } else {
    tone = 'idle'
    text = pick(id, [
      `Logged yesterday, nothing yet today`,
      `Was in it yesterday — today's still open`,
    ])
  }

  // ─── Secondary note: social neglect ─────────────────────────────────────
  let secondary: string | undefined
  if (everLogged) {
    if (daysSinceShoutout === undefined) secondary = 'No shoutout yet this month'
    else if (daysSinceShoutout >= 14) secondary = `Last shoutout ${daysSinceShoutout}d ago`
  }

  return { text, secondary, tone, score, urgency }
}
