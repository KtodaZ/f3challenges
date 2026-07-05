// ─── Challenge Definitions ────────────────────────────────────────────────────
// Single source of truth for all challenges.
//
// To add a new challenge:
//   1. Append one object to CHALLENGES below.
//   2. That's it — no other changes needed anywhere.
//
// This file is shared between the Next.js app and Cloud Functions via the
// @f3-bedrock/shared workspace package. Both consume it at build time
// (Next.js transpiles it; esbuild bundles it into functions/lib/index.js).

import type { BonusChallengeWeek, ChallengeTemplate, DailyTarget } from './types'

export const CHALLENGES: ChallengeTemplate[] = [
  {
    id: 'feb-2026',
    name: 'Merkin Challenge',
    hashtag: '#MerkinChallenge',
    tagline: 'The original. The foundation.',
    month: 2,
    year: 2026,
    type: 'escalating',
    dailyMultiplier: 10,
    startDate: '2026-02-01',
    endDate: '2026-02-28',
    exercises: [
      { id: 'merkin', name: 'Merkin', shortName: 'Merkin' },
    ],
  },
  {
    id: 'mar-2026',
    name: 'LBC Challenge',
    hashtag: '#LBCChallenge',
    tagline: 'Core strong. Every day.',
    month: 3,
    year: 2026,
    type: 'escalating',
    dailyMultiplier: 5,
    startDate: '2026-03-01',
    endDate: '2026-03-31',
    exercises: [
      { id: 'lbc', name: 'Little Baby Crunch', shortName: 'LBC' },
    ],
  },
  {
    id: 'apr-2026',
    name: 'The Merkin Gauntlet',
    hashtag: '#TheMerkinGauntlet',
    tagline: 'ONE MONTH. NO EXCUSES. CONQUER EM ALL',
    month: 4,
    year: 2026,
    type: 'escalating',
    dailyMultiplier: 10,
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    exercises: [
      { id: 'merkin',          name: 'Merkin',          shortName: 'Merkin'   },
      { id: 'diamond-merkin',  name: 'Diamond Merkin',  shortName: 'Diamond'  },
      { id: 'wide-merkin',     name: 'Wide Arm Merkin', shortName: 'Wide Arm' },
      { id: 'incline-merkin',  name: 'Incline Merkin',  shortName: 'Incline'  },
      { id: 'decline-merkin',  name: 'Decline Merkin',  shortName: 'Decline'  },
    ],
  },
  {
    id: 'may-2026',
    name: 'PPSD',
    hashtag: '#PPSD',
    tagline: 'Pullup. Pushup. Squat. DeadHang.',
    month: 5,
    year: 2026,
    type: 'weekly-tiers',
    startDate: '2026-05-01',
    endDate: '2026-05-31',
    exercises: [
      { id: 'pullup',    name: 'Pull-Up',   shortName: 'Pull-Up'  },
      { id: 'pushup',    name: 'Push-Up',   shortName: 'Push-Up'  },
      { id: 'air-squat', name: 'Air Squat', shortName: 'Squat'    },
      { id: 'dead-hang', name: 'Dead Hang', shortName: 'DeadHang', unit: 'seconds' },
    ],
    weeklyTiers: [
      {
        startDay: 1, endDay: 8,
        targets: [
          { exerciseId: 'pullup',    amount: 10 },
          { exerciseId: 'pushup',    amount: 20 },
          { exerciseId: 'air-squat', amount: 30 },
          { exerciseId: 'dead-hang', amount: 30 },
        ],
      },
      {
        startDay: 9, endDay: 16,
        targets: [
          { exerciseId: 'pullup',    amount: 20 },
          { exerciseId: 'pushup',    amount: 30 },
          { exerciseId: 'air-squat', amount: 40 },
          { exerciseId: 'dead-hang', amount: 60 },
        ],
      },
      {
        startDay: 17, endDay: 23,
        targets: [
          { exerciseId: 'pullup',    amount: 30 },
          { exerciseId: 'pushup',    amount: 40 },
          { exerciseId: 'air-squat', amount: 50 },
          { exerciseId: 'dead-hang', amount: 90 },
        ],
      },
      {
        startDay: 24, endDay: 31,
        targets: [
          { exerciseId: 'pullup',    amount: 40 },
          { exerciseId: 'pushup',    amount: 50 },
          { exerciseId: 'air-squat', amount: 60 },
          { exerciseId: 'dead-hang', amount: 120 },
        ],
      },
    ],
    // May 25: Memorial Day — no workout required
    restDates: ['2026-05-25'],
    // May 26: optional rest for those who logged a workout on Memorial Day (the Murph)
    conditionalRestDates: [
      {
        date: '2026-05-26',
        conditionLabel: 'Did you do the Murph yesterday?',
        conditionType: 'logged-previous-day',
      },
    ],
    copy: {
      welcomeTagline: 'Pull-ups. Push-ups. Squats. Dead hangs. Four movements, one month, no excuses.',
      feedPost: {
        day1: [
          "@{name} opens #PPSD right — {totalReps} reps across pull-ups, push-ups, and squats plus a dead hang. Day 1 of {totalDays} logged. 🔥 {hashtag}",
          "Pull-up. Push-up. Squat. Dead hang. @{name} knocked out all four on Day 1. {totalReps} reps. {hashtag} 💪",
          "@{name} sets the bar on Day 1 of #PPSD — {totalReps} reps, four movements. Now you know what's up. 🔥 {hashtag}",
          "Day 1: checked. @{name} started #PPSD with {totalReps} reps. Pull, push, squat, hang — all of it. {hashtag} 💪",
        ],
        regular: [
          "@{name} — Day {day}/{totalDays} of #PPSD. Pull-ups, push-ups, squats, dead hang: all done. {totalReps} reps. 💪 {hashtag}",
          "Pull. Push. Squat. Hang. @{name} checked every box on Day {day}. {totalReps} reps total. {hashtag} 🔥",
          "@{name} knocked out {totalReps} reps on Day {day} of #PPSD. Four movements, zero excuses. 💪 {hashtag}",
          "Day {day} logged. @{name} worked through pull-ups, push-ups, squats, and dead hangs — {totalReps} reps. {hashtag} 💪",
          "@{name} put in the work across all four PPSD movements. Day {day}/{totalDays}, {totalReps} reps. Who else is posting? {hashtag}",
        ],
        regularLate: [
          "Week {weekNumber} of PPSD hits harder — {totalReps} reps and @{name} didn't even flinch. Day {day}. 😏 {hashtag}",
          "@{name} on Day {day}: {totalReps} reps across four movements, and still has energy to trash-talk. 😂 {hashtag}",
          "Dead hangs getting long, reps getting heavy — @{name} still doesn't care. Day {day}, {totalReps} done. 😏 {hashtag}",
          "Week {weekNumber} asked for more. @{name} delivered {totalReps} reps on Day {day} without a complaint. 😏 {hashtag}",
        ],
        makeUp: [
          "@{name} came back for Day {day} — {totalReps} reps of pull-ups, push-ups, squats, and dead hangs. No skips. {hashtag} ✅",
          "Day {day} wasn't getting left behind. @{name} came back and knocked out {totalReps} PPSD reps. {hashtag}",
          "@{name} patched Day {day} — {totalReps} reps. Four movements. All accounted for. {hashtag} ✅",
        ],
      },
      notification: {
        day1Pending: {
          titles: [
            "PPSD Starts Now, {fn}",
            "Day 1 of #PPSD",
          ],
          bodies: [
            "Pull-ups, push-ups, squats, and a dead hang — that's what Day 1 asks for. Get after it, {fn}.",
            "{fn}, four movements stand between you and Day 1. Pull, push, squat, hang. Start now.",
          ],
        },
        day1Completed: {
          titles: [
            "PPSD Day 1 Done, {fn}! 🔥",
          ],
          bodies: [
            "Pull, push, squat, hang — Day 1 is behind you, {fn}. {daysRemaining} more days to build on it.",
            "Four movements. One day down. {fn} locked in Day 1 of #PPSD. {daysRemaining} days to go.",
          ],
        },
        halfPending: {
          titles: [
            "PPSD Halfway, {fn}",
          ],
          bodies: [
            "Day {dayNumber}: the halfway point. {repsRemaining} reps across four PPSD movements — finish the half strong, {fn}.",
          ],
        },
        halfCompleted: {
          titles: [
            "Halfway Through PPSD! 💪",
          ],
          bodies: [
            "Day {dayNumber} logged. Four movements, halfway through PPSD. The second half is where it gets real, {fn}.",
          ],
        },
        threeQuarterPending: {
          titles: [
            "PPSD Home Stretch, {fn}",
          ],
          bodies: [
            "Three-quarter mark, {fn}. {repsRemaining} reps across pull-ups, push-ups, squats, and dead hangs. Almost there — don't fold now.",
          ],
        },
        threeQuarterCompleted: {
          titles: [
            "75% of PPSD Done! 🔥",
          ],
          bodies: [
            "Three-quarters through #PPSD, {fn}. Day {dayNumber} done. {daysRemaining} days left — you've come too far to stop.",
          ],
        },
      },
    },
  },
  {
    id: 'jul-2026',
    name: 'July Functional Fitness Challenge',
    hashtag: '#JulyFFC',
    tagline: 'Hang. Merkin. Crunch. Lunge. Every day.',
    month: 7,
    year: 2026,
    type: 'weekly-tiers',
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    exercises: [
      { id: 'dead-hang',      name: 'Dead Hang',       shortName: 'Hang',    unit: 'seconds' },
      { id: 'diamond-merkin', name: 'Diamond Merkin',  shortName: 'Diamond'  },
      { id: 'std-merkin',     name: 'Standard Merkin', shortName: 'Std'      },
      { id: 'wide-merkin',    name: 'Wide Arm Merkin', shortName: 'Wide'     },
      { id: 'incline-merkin', name: 'Incline Merkin',  shortName: 'Incline'  },
      { id: 'decline-merkin', name: 'Decline Merkin',  shortName: 'Decline'  },
      { id: 'lbc',            name: 'Little Baby Crunch', shortName: 'LBC'   },
      { id: 'lunge',          name: 'Lunge (2:1)',     shortName: 'Lunge'    },
    ],
    weeklyTiers: [
      {
        startDay: 1, endDay: 31,
        targets: [
          { exerciseId: 'dead-hang',      amount: 180 },
          { exerciseId: 'diamond-merkin', amount: 20  },
          { exerciseId: 'std-merkin',     amount: 20  },
          { exerciseId: 'wide-merkin',    amount: 20  },
          { exerciseId: 'incline-merkin', amount: 20  },
          { exerciseId: 'decline-merkin', amount: 20  },
          { exerciseId: 'lbc',            amount: 100 },
          { exerciseId: 'lunge',          amount: 50  },
        ],
      },
    ],
    bonusChallenge: {
      name: 'Tour de Bedrock',
      weeks: [
        {
          startDate: '2026-07-01',
          endDate: '2026-07-04',
          description: 'Hit a pre-run at any AO',
          feedPostTemplates: [
            '@{name} ran early. Pre-run before the beatdown — Tour de Bedrock Week 1 done. 🏃 {hashtag}',
            'Pre-run checked. @{name} showed up before showing up. Tour de Bedrock Week 1 in the books. ☀️ {hashtag}',
            '@{name} called a pre-run warm-up. Some PAX just built different. Tour de Bedrock Week 1 done. {hashtag} 💪',
            'Some PAX sleep in. @{name} pre-ran. Tour de Bedrock Week 1 logged. 🔥 {hashtag}',
          ],
        },
        {
          startDate: '2026-07-05',
          endDate: '2026-07-11',
          description: 'Run 3 hill repeats at John G. Piches Park (Rattlesnake Ridge AO)',
          feedPostTemplates: [
            '@{name} ran 3 hill repeats at Rattlesnake Ridge. The hill didn\'t win. 🐍 {hashtag}',
            'Three times up Rattlesnake Ridge. @{name} earns Tour de Bedrock Week 2 the hard way. {hashtag} 🔥',
            '@{name} hit Rattlesnake Ridge 3 times and called it a Tuesday. Tour de Bedrock Week 2 done. 💪 {hashtag}',
            'Rattlesnake Ridge: conquered (3×). @{name} logged Tour de Bedrock Week 2. 🐍 {hashtag}',
          ],
        },
      ],
    },
    copy: {
      welcomeTagline: '3-min hang. 5 merkin variations (20 each). 100 LBCs. 50 lunges. Every single day.',
      feedPost: {
        day1: [
          "@{name} opens {challengeName} — hang, five merkin variations, 100 LBCs, and 50 lunges. Day 1 locked. 💪 {hashtag}",
          "Hang. Merkin. Crunch. Lunge. @{name} checked every box on Day 1. {hashtag} 🔥",
          "@{name} sets the standard on Day 1 of {hashtag} — {totalReps} reps plus a 3-minute hang. Let's go.",
        ],
        regular: [
          "@{name} — Day {day}/{totalDays}. Dead hang, five merkin variations, LBCs, lunges. All done. 💪 {hashtag}",
          "Day {day} in the books. @{name} hung, pushed, crunched, and lunged. {hashtag} 🔥",
          "@{name} put in the work on Day {day} of {hashtag}. {totalReps} reps plus the hang. No excuses.",
          "Hang. Merkin. LBC. Lunge. @{name} ran the whole list on Day {day}. {hashtag} 💪",
        ],
        regularLate: [
          "@{name} is still showing up — Day {day} of {hashtag} logged. 😏",
          "@{name} on Day {day}: hang, merkins, LBCs, lunges — all of it. Consistency is the challenge. {hashtag} 💪",
          "Late in the month and @{name} is still showing up. Day {day}/{totalDays}. {hashtag} 🔥",
        ],
        makeUp: [
          "@{name} came back for Day {day} — hang, merkins, LBCs, and lunges. Nothing left behind. {hashtag} ✅",
          "Day {day} wasn't getting skipped. @{name} made it up — {totalReps} reps plus the hang. {hashtag} ✅",
          "@{name} patched Day {day}: hang, five merkin variations, 100 LBCs, 50 lunges. All accounted for. {hashtag} ✅",
        ],
      },
      notification: {
        day1Pending: {
          titles: [
            'July FFC Starts Now, {fn}',
            'Day 1 of #JulyFFC',
          ],
          bodies: [
            '3-minute hang, five merkin variations, 100 LBCs, 50 lunges — that\'s the daily standard. Get after it, {fn}.',
            '{fn}, Day 1 is waiting: hang, five merkin variations, 100 LBCs, and 50 lunges. Start now.',
          ],
        },
        day1Completed: {
          titles: [
            'Day 1 Done, {fn}! 🔥',
          ],
          bodies: [
            'Hang, merkins, LBCs, lunges — Day 1 is behind you, {fn}. {daysRemaining} days to go.',
            'Day 1 done. {fn} hung, pushed through five merkin variations, crunched, and lunged. {daysRemaining} days to go.',
          ],
        },
        halfPending: {
          titles: [
            'Halfway Through July FFC, {fn}',
          ],
          bodies: [
            'Day {dayNumber}: the halfway point. Hang, five merkin variations, LBCs, and lunges — finish the half strong, {fn}.',
          ],
        },
        halfCompleted: {
          titles: [
            'Halfway Through July FFC! 💪',
          ],
          bodies: [
            'Day {dayNumber} logged. Halfway through. The second half is where it gets real, {fn}.',
          ],
        },
        threeQuarterPending: {
          titles: [
            'Home Stretch, {fn}',
          ],
          bodies: [
            'Three-quarter mark, {fn}. Hang. Five merkin variations. 100 LBCs. 50 lunges. Almost there — don\'t fold now.',
          ],
        },
        threeQuarterCompleted: {
          titles: [
            '75% of July FFC Done! 🔥',
          ],
          bodies: [
            'Three-quarters through July FFC, {fn}. Day {dayNumber} done. {daysRemaining} days left — you\'ve come too far to stop.',
          ],
        },
      },
    },
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the challenge active on a given date, or undefined. */
export function getChallengeForDate(date: string): ChallengeTemplate | undefined {
  return CHALLENGES.find(c => date >= c.startDate && date <= c.endDate)
}

/** Returns today's active challenge (PT date). */
export function getCurrentChallenge(): ChallengeTemplate | undefined {
  return getChallengeForDate(getTodayPT())
}

export function getChallengeById(id: string): ChallengeTemplate | undefined {
  return CHALLENGES.find(c => c.id === id)
}

/**
 * Returns day number (1-based) for a given date within a challenge.
 * Returns null if the date is outside the challenge window.
 */
export function getDayNumber(challenge: ChallengeTemplate, date: string): number | null {
  if (date < challenge.startDate || date > challenge.endDate) return null
  const start = new Date(challenge.startDate + 'T00:00:00')
  const d     = new Date(date + 'T00:00:00')
  const diff  = Math.round((d.getTime() - start.getTime()) / 86_400_000)
  return diff + 1
}

/** Returns true if the given date is a fixed rest day (no log required for anyone). */
export function isRestDay(challenge: ChallengeTemplate, date: string): boolean {
  return challenge.restDates?.includes(date) ?? false
}

/**
 * Returns true if a conditional rest day applies to a specific user.
 * Pass the dates the user has completed (completionFraction >= 1).
 */
export function conditionalRestApplies(
  challenge: ChallengeTemplate,
  date: string,
  completedLogDates: string[],
): boolean {
  const cr = challenge.conditionalRestDates?.find(r => r.date === date)
  if (!cr) return false
  if (cr.conditionType === 'logged-previous-day') {
    const d = new Date(date + 'T00:00:00')
    d.setDate(d.getDate() - 1)
    const prev = d.toLocaleDateString('en-CA')
    return completedLogDates.includes(prev)
  }
  return false
}

/** Computes the daily target for a given challenge and date. */
export function getDailyTarget(challenge: ChallengeTemplate, date: string): DailyTarget | null {
  const day = getDayNumber(challenge, date)
  if (day === null) return null

  // Fixed rest days: return a rest-day marker with no exercises
  if (challenge.restDates?.includes(date)) {
    return { date, day, isRestDay: true, totalReps: 0, repsPerExercise: 0, exercises: [] }
  }

  // Conditional rest day: normal target but flagged so the UI can show the option
  const conditionalRest = challenge.conditionalRestDates?.find(r => r.date === date)

  const challengeType = challenge.type ?? 'escalating'

  if (challengeType === 'weekly-tiers') {
    const tier = challenge.weeklyTiers?.find(t => day >= t.startDay && day <= t.endDay)
    if (!tier) return null

    const exercises = challenge.exercises.map(ex => {
      const t = tier.targets.find(t => t.exerciseId === ex.id)
      return { exercise: ex, reps: t?.amount ?? 0 }
    })

    // totalReps counts rep-type exercises only (not timed)
    const totalReps = exercises.reduce((sum, e) => {
      return (e.exercise.unit ?? 'reps') === 'reps' ? sum + e.reps : sum
    }, 0)

    const firstRepTarget = exercises.find(e => (e.exercise.unit ?? 'reps') === 'reps')?.reps ?? 0

    return {
      date,
      day,
      isRestDay: false,
      ...(conditionalRest ? { isConditionalRestDay: true, conditionalRestLabel: conditionalRest.conditionLabel } : {}),
      totalReps,
      repsPerExercise: firstRepTarget,
      exercises,
    }
  }

  // 'escalating' (default)
  const totalReps = day * (challenge.dailyMultiplier ?? 0)
  const repsPerExercise = challenge.exercises.length > 0 ? totalReps / challenge.exercises.length : totalReps

  return {
    date,
    day,
    isRestDay: false,
    ...(conditionalRest ? { isConditionalRestDay: true, conditionalRestLabel: conditionalRest.conditionLabel } : {}),
    totalReps,
    repsPerExercise,
    exercises: challenge.exercises.map(ex => ({ exercise: ex, reps: repsPerExercise })),
  }
}

/** Total calendar days in the challenge. */
export function getTotalDays(challenge: ChallengeTemplate): number {
  const start = new Date(challenge.startDate + 'T00:00:00')
  const end   = new Date(challenge.endDate + 'T00:00:00')
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
}

/** Returns the day numbers of the 25%/50%/75% milestones for a challenge. */
export function getMilestoneDays(challenge: ChallengeTemplate): { quarter: number; half: number; threeQuarter: number } {
  const total = getTotalDays(challenge)
  return {
    quarter:      Math.round(total * 0.25),
    half:         Math.round(total * 0.5),
    threeQuarter: Math.round(total * 0.75),
  }
}

/**
 * Days that require a log — excludes only fixed rest days.
 * Conditional rest days are per-user and not subtracted here; callers handle
 * those based on whether the condition was met for that specific user.
 */
export function getRequiredDays(challenge: ChallengeTemplate): number {
  return getTotalDays(challenge) - (challenge.restDates?.length ?? 0)
}

/** Returns total reps for the full challenge month (rep-type exercises only, rest days excluded). */
export function getMonthlyTotal(challenge: ChallengeTemplate): number {
  return getChallengeDates(challenge).reduce((total, date) => {
    const target = getDailyTarget(challenge, date)
    return target && !target.isRestDay ? total + target.totalReps : total
  }, 0)
}

/** Returns today's date as YYYY-MM-DD in PT timezone. */
export function getTodayPT(): string {
  return new Date()
    .toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
}

/** Returns reps completed as a fraction of today's target. */
export function repsFractionLabel(fraction: number): string {
  if (fraction >= 1)    return 'Done ✓'
  if (fraction >= 0.75) return '3/4 Done'
  if (fraction >= 0.5)  return 'Halfway'
  if (fraction >= 0.25) return '1/4 Done'
  return 'Not started'
}

/** Returns the active bonus challenge week for a given date, if any. */
export function getCurrentBonusWeek(challenge: ChallengeTemplate, date: string): BonusChallengeWeek | undefined {
  return challenge.bonusChallenge?.weeks.find(w => date >= w.startDate && date <= w.endDate)
}

/**
 * Picks a random completion feed post for a bonus week, substituting {name} and {hashtag}.
 * When `isMakeUp` is true, uses a "catching up" flavored post instead of the on-time variants.
 */
export function getBonusWeekFeedPost(
  bonusName: string,
  week: BonusChallengeWeek,
  hashtag: string,
  displayName: string,
  isMakeUp = false,
): string {
  if (isMakeUp) {
    const makeUpTemplates = [
      `@${displayName} circled back and knocked out a ${bonusName} bonus — ${week.description}. Better late than never. 💪 ${hashtag}`,
      `Catching up: @${displayName} made up a missed ${bonusName} bonus week. No week left behind. 🔥 ${hashtag}`,
      `@${displayName} went back and finished the ${bonusName} bonus — ${week.description}. Respect the follow-through. 🏃 ${hashtag}`,
      `Nothing gets skipped. @${displayName} made up a ${bonusName} bonus week. 💯 ${hashtag}`,
    ]
    return makeUpTemplates[Math.floor(Math.random() * makeUpTemplates.length)]
  }
  const templates = week.feedPostTemplates
  if (!templates || templates.length === 0) {
    return `@${displayName} completed the ${bonusName} bonus — ${week.description}! 🏃 ${hashtag}`
  }
  const t = templates[Math.floor(Math.random() * templates.length)]
  return t.replace(/\{name\}/g, displayName).replace(/\{hashtag\}/g, hashtag)
}

/** All dates in a challenge as YYYY-MM-DD strings. */
export function getChallengeDates(challenge: ChallengeTemplate): string[] {
  const dates: string[] = []
  // Use noon UTC so date string extraction is unambiguous in any runtime timezone.
  const current = new Date(challenge.startDate + 'T12:00:00Z')
  const end     = new Date(challenge.endDate + 'T12:00:00Z')
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10))
    current.setUTCDate(current.getUTCDate() + 1)
  }
  return dates
}
