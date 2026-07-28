// ─── Per-Challenge Copy System ────────────────────────────────────────────────
// Single source of truth for all user-facing message templates.
//
// Templates use {placeholder} syntax. Available vars per surface:
//   Feed posts:     {name} {day} {totalDays} {totalReps} {exerciseCount}
//                   {hashtag} {challengeName} {exerciseName} {daysLeft}
//                   {percent} {weekNumber} (weekly-tier challenges only)
//   Notifications:  {fn} {dayNumber} {totalDays} {daysRemaining}
//                   {repsRemaining} {challengeName} {workRemaining}
//
// {workRemaining} is the exercise-aware phrase for what's left today
// ("20 incline merkins and 20 decline merkins") — prefer it over
// "{repsRemaining} reps" in pending copy.
//
// Challenge-specific templates augment (not replace) the defaults, so every
// challenge gets the full variety of generic copy plus its own flavor.
// To add per-challenge copy: add a `copy` field to the challenge in challenges.ts.

import type {
  ChallengeTemplate,
  ChallengeTemplateCopy,
  FeedPostVars,
  NotificationTemplatePair,
  NotificationVars,
} from './types'

export type { ChallengeTemplateCopy, FeedPostVars, NotificationTemplatePair, NotificationVars }

// ─── Template Renderer ────────────────────────────────────────────────────────

export function renderTemplate(
  template: string,
  vars: Record<string, string | number | undefined>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in vars && vars[key] !== undefined ? String(vars[key]) : match
  )
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickSeeded<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length]
}

// ─── Default Feed Post Templates ─────────────────────────────────────────────

const DEFAULT_FEED: Record<keyof Required<NonNullable<ChallengeTemplateCopy['feedPost']>>, string[]> = {
  day1: [
    "{challengeName} begins. @{name} posted Day 1 — {totalReps} reps, no hesitation. Let's go. 🔥 {hashtag}",
    "@{name} didn't come to watch. Day 1 of {totalDays} — {totalReps} reps on the board. {hashtag} 💪",
    "First day, first reps. @{name} opens {hashtag} the right way — {totalReps} on the board. 🔥",
    "@{name} opened {challengeName} with {totalReps} reps. Day 1 of {totalDays}. This is how it's done. 💪 {hashtag}",
    "The first rep is always the hardest. @{name} knocked out {totalReps} of them on Day 1. 🔥 {hashtag}",
    "Day 1 of {totalDays} is in the books for @{name}. {totalReps} reps — first of many. 💪 {hashtag}",
    "@{name} is in — Day 1 starts now. {totalReps} reps on the board. Who's next? {hashtag} 🔥",
  ],
  quarter: [
    "One quarter down. @{name} has cleared {day} of {totalDays} days — {totalReps} reps today and no signs of stopping. 💪 {hashtag}",
    "25% complete. @{name} is through the first quarter of {challengeName} — Day {day} done, {totalReps} reps. 🔥 {hashtag}",
    "@{name} just hit the quarter mark. Day {day}/{totalDays}, {totalReps} reps — three-quarters of {challengeName} still to go. 💪 {hashtag}",
    "Through the first quarter and @{name} hasn't blinked. Day {day}, {totalReps} reps. {daysLeft} days remain. 🔥 {hashtag}",
    "@{name} — Day {day} of {totalDays} means 25% of {challengeName} is behind them. {totalReps} reps down. Who's keeping up? {hashtag}",
    "First quarter logged. @{name} with {totalReps} reps on Day {day} — looking like this might go all the way. 💪 {hashtag}",
  ],
  half: [
    "Halfway. @{name} has reached the midpoint of {challengeName} — Day {day}/{totalDays}, {totalReps} reps. The second half starts now. 🔥 {hashtag}",
    "@{name} is exactly halfway through. Day {day} of {totalDays} — {totalReps} reps. You either quit now or you don't. 💪 {hashtag}",
    "Day {day}/{totalDays}. @{name} just crossed the halfway line. {totalReps} reps. Same distance to go as already covered. 🔥 {hashtag}",
    "50% complete. @{name} hit the halfway mark — Day {day}, {totalReps} reps. No looking back now. 💪 {hashtag}",
    "@{name} punched through the midpoint of {hashtag}. {day} down, {daysLeft} to go. {totalReps} reps today — stay hungry.",
    "The halfway point belongs to @{name}. Day {day} of {totalDays} done — {totalReps} reps, no quit in sight. {hashtag} 💪",
  ],
  threeQuarter: [
    "@{name} is in the home stretch — Day {day}/{totalDays}, {totalReps} reps. 75% through {challengeName}. Finish what you started. 🔥 {hashtag}",
    "Three-quarters done. @{name} just logged Day {day} — {totalReps} reps. Only {daysLeft} days to a clean finish. 💪 {hashtag}",
    "Day {day} of {totalDays} and @{name} is still here. {totalReps} reps at 75% complete. The end is in sight. 🔥 {hashtag}",
    "75% done. @{name} — Day {day}, {totalReps} reps. One final push to close this out. 💪 {hashtag}",
    "@{name} with {totalReps} reps on Day {day} — three-quarters of {challengeName} in the books. Don't stop now. 🔥 {hashtag}",
    "Day {day} of {totalDays} — @{name} has {daysLeft} days left to finish what they started. {totalReps} reps logged. 💪 {hashtag}",
  ],
  makeUp: [
    "@{name} went back and made up Day {day} — {totalReps} reps. No unfinished business. 💪 {hashtag}",
    "@{name} circled back to Day {day} and knocked out {totalReps} reps. Better late than never. 🔥 {hashtag}",
    "Day {day} wasn't getting left behind — @{name} came back and got it done. {totalReps} reps. ✅ {hashtag}",
    "@{name} didn't let Day {day} slip — {totalReps} reps in the books. 🏋️ {hashtag}",
    "No gaps — @{name} patched Day {day} with {totalReps} reps. ✅ {hashtag}",
    "@{name} said Day {day} doesn't count as a miss. {totalReps} reps later, they're right. 💪 {hashtag}",
    "Make-up day done. @{name} erased the gap — Day {day}, {totalReps} reps completed. {hashtag} ✅",
    "@{name} went back and knocked out Day {day}. {totalReps} reps — late but logged. That's accountability, brother. {hashtag}",
    "Miss a day? @{name} doesn't let it slide. Day {day} backfilled with {totalReps} reps. {hashtag}",
    "@{name} circled back for Day {day} — {totalReps} reps posted. {challengeName} doesn't have an expiration date. {hashtag}",
    "Day {day} wasn't forgotten. @{name} came back for those {totalReps} reps. No gap in the log. {hashtag}",
    "@{name} refused to leave Day {day} blank. {totalReps} reps — better late than never, and better late than most. {hashtag}",
  ],
  regular: [
    "@{name} just put in the work — Day {day}/{totalDays}, {totalReps} reps done. 💪 {hashtag}",
    "@{name} is accelerating — Day {day}/{totalDays}, {totalReps} reps down. 🔥 {hashtag}",
    "Day {day} checked. @{name} knocked out {totalReps} reps. No days off. 💪 {hashtag}",
    "@{name} — Day {day}/{totalDays}, {totalReps} reps on the board. 🏋️ {hashtag}",
    "{totalReps} reps. Day {day}. @{name} checked the box. 💪 {hashtag}",
    "@{name} didn't come to play — Day {day} of {challengeName} complete. {totalReps} reps. 💪 {hashtag}",
    "Day {day}/{totalDays} — @{name} put in the work. {totalReps} reps completed. 💪 {hashtag}",
    "@{name} is {percent}% through {challengeName}. Day {day} — {totalReps} reps. 🔥 {hashtag}",
    "Day {day} logged. @{name} earned it — {totalReps} reps, {exerciseCount} variations. {hashtag} 💪",
    "@{name} put up {totalReps} reps on Day {day}. ✅ {hashtag}",
    "✅ Day {day} of {totalDays} — @{name} cleared {totalReps} reps. {hashtag}",
    "Day {day}, {totalReps} reps. @{name} delivered. 💪 {hashtag}",
    "@{name} — Day {day}/{totalDays}, {totalReps} reps. No days off. 🔥 {hashtag}",
    "{challengeName} asked for {totalReps} on Day {day}. @{name} answered. 💪 {hashtag}",
    "@{name} — Day {day} of {totalDays}. {totalReps} reps in the bank. 🏋️ {hashtag}",
    "{totalReps} reps. {exerciseCount} variations. 1 PAX who doesn't quit. @{name}. Day {day}. 🔥 {hashtag}",
    "@{name} coming back strong — Day {day}, {totalReps} reps. 💪 {hashtag}",
    "@{name} knocked out their reps for Day {day}. Will you? {totalReps} on the board. 🔥 {hashtag}",
    "Let's go @{name} — Day {day} done, {totalReps} reps in the books. 💪 {hashtag}",
    "Another one in the bag. @{name} — Day {day}, {totalReps} reps. ✅ {hashtag}",
    "Day {day} didn't stand a chance. @{name} — {totalReps} reps, done. 💪 {hashtag}",
    "@{name} making {totalReps} reps look like a warm-up. Day {day}. 🔥 {hashtag}",
    "Who's next? @{name} just set the pace on Day {day} — {totalReps} reps. 🔥 {hashtag}",
    "Day {day} was already on @{name}'s schedule. {totalReps} reps, no drama. ✅ {hashtag}",
    "@{name} just crushed {totalReps} reps across {exerciseCount} variations. Day {day}/{totalDays} in the books. {hashtag}",
    "{totalReps} reps. {exerciseCount} ways to suffer. @{name} didn't blink. Day {day} done. {hashtag}",
    "@{name} checked the box on Day {day}. {totalReps} reps, no excuses. Who else is posting today? {hashtag}",
    "Day {day} belongs to @{name}. {totalReps} reps handled. {daysLeft} days left — will you keep pace? {hashtag}",
    "@{name} just stacked another {totalReps} reps on the pile. Day {day}/{totalDays}. {challengeName} doesn't care about your feelings. {hashtag}",
    "Quiet day for @{name} — only {totalReps} reps across {exerciseCount} variations. Casual. {hashtag}",
    "@{name} punched Day {day} in the mouth. {totalReps} reps down. Your move. {hashtag}",
    "{challengeName} demanded {totalReps} reps today. @{name} delivered. Day {day}/{totalDays}. {hashtag}",
    "@{name} — Day {day} complete. {totalReps} reps, {exerciseCount} exercises, zero quit. Are you in or are you watching? {hashtag}",
    "Another day, another stack. @{name} posted {totalReps} reps on Day {day}. {hashtag}",
  ],
  regularLate: [
    "@{name} logged Day {day} — {totalReps} reps. Still showing up. {hashtag}",
    "Day {day}/{totalDays}. @{name} put in {totalReps} reps. {daysLeft} days left. {hashtag}",
    "@{name} — Day {day}, {totalReps} reps done. The back half is about consistency. {hashtag}",
    "Late in the month and @{name} is still checking the box. Day {day}, {totalReps} reps. {hashtag}",
    "@{name} knocked out {totalReps} reps on Day {day}. {daysLeft} days to the finish. {hashtag}",
    "Day {day} done for @{name} — {totalReps} reps. No days off. {hashtag}",
    "@{name} stayed on it. Day {day}/{totalDays}, {totalReps} reps. {hashtag}",
    "{totalReps} reps, Day {day}. @{name} keeps stacking them. {hashtag}",
    "@{name} closed out Day {day} — {totalReps} reps. Steady as it goes. {hashtag}",
  ],
}

// ─── Default Notification Templates ──────────────────────────────────────────

const DEFAULT_NOTIF: Record<keyof Required<NonNullable<ChallengeTemplateCopy['notification']>>, NotificationTemplatePair> = {
  day1Completed: {
    titles: [
      "Day 1 Done, {fn}! 🔥",
      "{challengeName} Is On",
      "First Rep, First Check ✅",
      "You Started — Now Finish",
      "Day 1 In the Books, {fn}",
    ],
    bodies: [
      "Day 1 of {totalDays} logged. You set the tone — {daysRemaining} more days to the finish line.",
      "First day down. {challengeName} has started and {fn} showed up. {daysRemaining} days to go.",
      "Day 1 done. The hardest part was starting — you already did that. {daysRemaining} days left.",
      "{fn} opened {challengeName} right. Day 1 complete. Keep this up and the finish line takes care of itself.",
      "The challenge is on. Day 1 is yours, {fn} — {daysRemaining} more to close it out clean.",
    ],
  },
  day1Pending: {
    titles: [
      "Day 1 Starts Now, {fn}",
      "{challengeName} Is On",
      "First Reps of the Month",
      "Start Strong, {fn}",
      "Day 1 — Don't Wait",
    ],
    bodies: [
      "Day 1 of {totalDays}: {workRemaining}. The crew is watching — go first.",
      "{challengeName} kicked off today. {workRemaining} on Day 1 — get it done, {fn}.",
      "First day of {challengeName}. {workRemaining} standing between you and Day 1. Go.",
      "{fn}, Day 1 is now: {workRemaining}. First PAX to finish sets the standard.",
      "It starts today. {workRemaining}, Day 1 of {totalDays}. Lock in, {fn}.",
    ],
  },
  quarterCompleted: {
    titles: [
      "One Quarter Done, {fn}! 💪",
      "25% Through {challengeName}",
      "First Quarter Logged ✅",
      "Day {dayNumber} — Quarter Mark",
      "You're 25% There, {fn}",
    ],
    bodies: [
      "Day {dayNumber} logged. First quarter of {challengeName} in the books — {daysRemaining} days to the finish.",
      "Through the first quarter and still standing. {daysRemaining} days left, {fn} — keep the pace.",
      "25% complete. Day {dayNumber} done. Three-quarters of {challengeName} still ahead — don't slow down now.",
      "{fn}, you cleared the first quarter. {daysRemaining} days remain. Same energy.",
      "Quarter mark reached. Day {dayNumber} of {totalDays} done — the hardest quarter is behind you.",
    ],
  },
  quarterPending: {
    titles: [
      "Quarter Mark, {fn}",
      "Day {dayNumber} — 25% Milestone",
      "First Quarter on the Line",
      "Close the Quarter, {fn}",
      "25% — Finish Day {dayNumber}",
    ],
    bodies: [
      "Day {dayNumber} is the quarter mark. {workRemaining} to close out the first 25% strong.",
      "You're a quarter of the way through {challengeName}. {workRemaining} left on Day {dayNumber} — don't let it slip.",
      "Day {dayNumber} of {totalDays}: the first quarter ends today. {workRemaining} — go earn it, {fn}.",
      "{fn}, close the first quarter right. {workRemaining} on Day {dayNumber}. Don't leave it unfinished.",
      "25% milestone. {workRemaining} between you and a clean first quarter. Go, {fn}.",
    ],
  },
  halfCompleted: {
    titles: [
      "Halfway There, {fn}! 🔥",
      "The Midpoint Is Yours",
      "Day {dayNumber} — 50% Done",
      "Halfway Through {challengeName} ✅",
      "You're Half Done, {fn}",
    ],
    bodies: [
      "Day {dayNumber} done. Halfway through {challengeName}. Same distance to the finish as you've already covered — don't stop.",
      "Midpoint reached. {fn}, you've logged {dayNumber} straight days. {daysRemaining} to go — finish what you started.",
      "50% complete. Day {dayNumber} logged. The second half of {challengeName} starts now — keep the momentum.",
      "You're halfway through {challengeName}, {fn}. Day {dayNumber} done. The back half is where it gets decided.",
      "Day {dayNumber} of {totalDays} — half of {challengeName} behind you. Stay locked in for the finish.",
    ],
  },
  halfPending: {
    titles: [
      "Halfway Mark, {fn}",
      "Day {dayNumber} — The Midpoint",
      "50% Milestone Today",
      "Finish the First Half, {fn}",
      "Don't Let Halfway Slip",
    ],
    bodies: [
      "Day {dayNumber} is the halfway mark. {workRemaining} to close the first half — don't let it slip, {fn}.",
      "You're at the midpoint of {challengeName}. {workRemaining} left on Day {dayNumber}. Finish the half strong.",
      "Day {dayNumber} of {totalDays}: halfway. {workRemaining} left to close the first half. Go, {fn}.",
      "{fn}, the halfway line is right there. {workRemaining} on Day {dayNumber}. Cross it.",
      "50% milestone. {workRemaining} between you and the halfway point. Make it count, {fn}.",
    ],
  },
  threeQuarterCompleted: {
    titles: [
      "Home Stretch, {fn}! 🔥",
      "75% Done — Finish It",
      "Three-Quarters Through ✅",
      "Day {dayNumber} — Almost There",
      "{daysRemaining} Days Left, {fn}",
    ],
    bodies: [
      "Day {dayNumber} logged. Three-quarters through {challengeName} — {daysRemaining} days to a clean finish.",
      "75% complete, {fn}. You've come too far to fold now. {daysRemaining} days left — lock in.",
      "Three-quarters of {challengeName} behind you. Day {dayNumber} done. The finish line is real from here.",
      "Day {dayNumber} of {totalDays} — {fn}, you're in the home stretch. {daysRemaining} days. Don't let up.",
      "75% done. Day {dayNumber} checked. {daysRemaining} days between you and a complete {challengeName} — go get it.",
    ],
  },
  threeQuarterPending: {
    titles: [
      "Home Stretch, {fn}",
      "75% Milestone — Close It",
      "Day {dayNumber} — Three-Quarter Mark",
      "Almost There, Don't Fold",
      "{daysRemaining} Days Left After This",
    ],
    bodies: [
      "Day {dayNumber}: 75% through {challengeName}. {workRemaining} — don't let up this close to done.",
      "Three-quarter mark, {fn}. {workRemaining} on Day {dayNumber}. Finish it and you're in the home stretch.",
      "You're 75% through {challengeName}. {workRemaining} left on Day {dayNumber} — close this out right.",
      "{fn}, {daysRemaining} days after today. {workRemaining} right now. Don't leave the three-quarter mark unfinished.",
      "75% milestone. {workRemaining} on Day {dayNumber}. Close it out, {fn}.",
    ],
  },
}

// ─── Public Helpers ───────────────────────────────────────────────────────────

/** Returns the merged template pool for a feed post section (defaults + challenge overrides). */
export function getFeedPostTemplates(
  challenge: ChallengeTemplate,
  section: keyof NonNullable<ChallengeTemplateCopy['feedPost']>,
): string[] {
  const custom = challenge.copy?.feedPost?.[section]
  const defaults = DEFAULT_FEED[section]
  return custom && custom.length > 0 ? [...defaults, ...custom] : defaults
}

/** Returns the merged notification template pair for a section (defaults + challenge overrides). */
export function getNotificationTemplates(
  challenge: ChallengeTemplate,
  section: keyof NonNullable<ChallengeTemplateCopy['notification']>,
): NotificationTemplatePair {
  const custom = challenge.copy?.notification?.[section]
  const defaults = DEFAULT_NOTIF[section]
  return {
    titles: custom?.titles?.length ? [...defaults.titles, ...custom.titles] : defaults.titles,
    bodies: custom?.bodies?.length ? [...defaults.bodies, ...custom.bodies] : defaults.bodies,
  }
}

/** Renders a seeded title + body from a notification template pair. */
export function renderNotification(
  pair: NotificationTemplatePair,
  seed: number,
  vars: NotificationVars,
): { title: string; body: string } {
  const v = {
    ...vars,
    workRemaining: vars.workRemaining || `${vars.repsRemaining} reps`,
  } as unknown as Record<string, string | number | undefined>
  return {
    title: renderTemplate(pickSeeded(pair.titles, seed), v),
    body:  renderTemplate(pickSeeded(pair.bodies, seed + 1), v),
  }
}

/** Renders a random feed post from the merged pool for a section. */
export function buildFeedPost(
  challenge: ChallengeTemplate,
  section: keyof NonNullable<ChallengeTemplateCopy['feedPost']>,
  vars: FeedPostVars,
): string {
  const pool = getFeedPostTemplates(challenge, section)
  return renderTemplate(pickRandom(pool), vars as unknown as Record<string, string | number | undefined>)
}
