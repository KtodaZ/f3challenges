/**
 * Who counts as "in" a challenge.
 *
 * Lives in shared because two very different consumers need the identical
 * answer: the app (crew lists, PAX totals, leaderboard rows) and the
 * notification Cloud Function (group-completion counts and the name lists in
 * push copy). When those two disagree, a PAX is told "18/24 done" by the app
 * and "18/21 done" by a push five minutes later.
 */

export type ParticipationStatus = 'active' | 'opted-out' | 'modifying'

/** First N days of a challenge where everyone (except opt-outs) is treated as
 *  participating — nobody has logs yet, so activity can't be the signal. */
export const PARTICIPANT_GRACE_DAYS = 3

/**
 * Whether a user counts as participating in the current challenge, for
 * crew lists (Push Your Crew, Call Out) and PAX totals.
 *
 * Participating = not opted out, AND any of:
 *  - explicitly opted in (participation doc with status active/modifying)
 *  - has logged at least one day of this challenge
 *  - it's still the grace window at the start of the challenge
 *
 * The activity clause is what keeps dormant signups — PAX who created an
 * account and never logged a rep — out of denominators once the grace window
 * closes, without anyone having to notice and archive them.
 */
export function isChallengeParticipant(
  status: ParticipationStatus | undefined,
  hasLoggedThisChallenge: boolean,
  dayNumber: number,
): boolean {
  if (status === 'opted-out') return false
  if (status === 'active' || status === 'modifying') return true
  return hasLoggedThisChallenge || dayNumber <= PARTICIPANT_GRACE_DAYS
}
