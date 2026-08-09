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

import type {
  BonusChallengeWeek, ChallengeTemplate, DailyTarget, Exercise, ExerciseLoad,
  LoggedSet, ResolvedWeek, WeekProgress,
} from './types'
import { DEFAULT_REGION_ID } from './regions'

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
      {
        id: 'dead-hang', name: 'Dead Hang', shortName: 'Hang', unit: 'seconds',
        encouragements: [
          'Finish those dead hangs — find a bar and hang on. {remaining} and today is in the books.',
          'Just the hang left. {remaining} on the bar — grip it and grit it out.',
          'One thing left: {remaining} of dead hang. The bar is waiting.',
        ],
      },
      {
        id: 'diamond-merkin', name: 'Diamond Merkin', shortName: 'Diamond',
        encouragements: [
          "You've got diamond merkins left. Get on the floor and pump out a set — the hardest part is starting.",
          'Just {remaining} diamond merkins to go. Hands in, core tight, knock them out.',
        ],
      },
      {
        id: 'std-merkin', name: 'Standard Merkin', shortName: 'Std',
        encouragements: [
          "You've got merkins left. Just get on the floor and pump out a set — the hardest part is starting.",
          '{remaining} standard merkins between you and done. Drop and go.',
        ],
      },
      {
        id: 'wide-merkin', name: 'Wide Arm Merkin', shortName: 'Wide',
        encouragements: [
          'Only the wide arms left — {remaining} to go. Spread the hands, hit the floor.',
          "{remaining} wide arm merkins and you're done for the day. Pump out a set.",
        ],
      },
      {
        id: 'incline-merkin', name: 'Incline Merkin', shortName: 'Incline',
        encouragements: [
          'Just the inclines left. Find a bench, a couch, a wall — {remaining} and done.',
          '{remaining} incline merkins to close the day. Easiest ones on the list — go.',
        ],
      },
      {
        id: 'decline-merkin', name: 'Decline Merkin', shortName: 'Decline',
        encouragements: [
          'Declines are all that stand between you and done — feet up, {remaining} to go.',
          'Just {remaining} decline merkins left. Kick the feet up and finish it.',
        ],
      },
      {
        id: 'lbc', name: 'Little Baby Crunch', shortName: 'LBC', plural: 'LBCs',
        encouragements: [
          '{remaining} LBCs to go. Hit the deck — crunch time, literally.',
          'Just the LBCs left. Lie down, knock out {remaining}, call it a day.',
        ],
      },
      {
        id: 'lunge', name: 'Lunge (2:1)', shortName: 'Lunge',
        encouragements: [
          '{remaining} lunges left. Walk them out — hallway, driveway, wherever.',
          "Only the lunges left. {remaining} steps and today's box is checked.",
        ],
      },
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
    // Badge of the Month — pinned on the home card, extra fanfare on unlock
    featuredBadgeId: 'quick-rebound',
    badges: [
      {
        id: 'jul-2026-machine',
        name: 'The Machine',
        emoji: '🦾',
        description: 'Every single day of the July FFC. Built different.',
        howTo: 'Fully complete every day of the July Functional Fitness Challenge — makeups count.',
        criteria: { type: 'complete-challenge' },
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
        {
          startDate: '2026-07-12',
          endDate: '2026-07-18',
          description: 'Heavy ruck or carry (45+ lb) up Sierra College Blvd and back — Miners Ravine Trailhead to Secret Ravine Blvd, round trip. No ruck? A cinder block or sandbag counts.',
          feedPostTemplates: [
            '@{name} rucked 45+ lb up Sierra College Blvd and back — Miners Ravine to Secret Ravine, round trip. The weight didn\'t carry itself. 🎒 {hashtag}',
            'Up the hill and back down. @{name} hauled the weight both ways on Sierra College Blvd for Tour de Bedrock Week 3. 💪 {hashtag}',
            '@{name} carried the load up Sierra College Blvd and back — ruck, cinder block, sandbag, whatever it took. Week 3 done. 🧱 {hashtag}',
            'Miners Ravine to Secret Ravine and back, 45 lb on the back the whole way. @{name} earns Tour de Bedrock Week 3. 🔥 {hashtag}',
          ],
        },
        {
          startDate: '2026-07-19',
          endDate: '2026-07-25',
          description: 'Bear crawl up Claudio and then back down. Bonus bonus: do it twice.',
          feedPostTemplates: [
            '@{name} bear crawled up Claudio and back down. Palms and toes only — Tour de Bedrock Week 4 done. 🐻 {hashtag}',
            'Up Claudio and down, on all fours. @{name} earned Tour de Bedrock Week 4 the hard way. 🔥 {hashtag}',
            '@{name} bear crawled Claudio — up and back. Some PAX went twice. Week 4 in the books. 💪 {hashtag}',
            'Claudio never stood a chance. @{name} bear crawled up and down for Tour de Bedrock Week 4. 🐻 {hashtag}',
          ],
        },
        {
          startDate: '2026-07-26',
          endDate: '2026-07-31',
          description: 'Time trial around the big circle at Divento (Maidu Park). Post your time with picture proof.',
          feedPostTemplates: [
            '@{name} ran the time trial around the big circle at Divento — clock stopped, proof posted. ⏱️ {hashtag}',
            'Time trial done. @{name} lapped the big circle at Maidu Park and dropped a time to beat. 🏃 {hashtag}',
            '@{name} circled Divento against the clock and posted the receipt. Tour de Bedrock Week 5 in the books. ⏱️ {hashtag}',
            'The clock doesn\'t lie. @{name} ran the Divento loop and posted the proof. Who\'s chasing that time? 🔥 {hashtag}',
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
          "@{name} on Day {day}: hang, merkins, LBCs, lunges — all of it. Consistency is the challenge. {hashtag} 💪",
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
  {
    id: 'aug-2026',
    regionIds: ['bedrock'],
    name: 'The Bedrock Bicep Challenge',
    hashtag: '#BedrockBicep',
    tagline: '300 curls a week. Any variation. However you want it. 💪',
    month: 8,
    year: 2026,
    type: 'weekly-cumulative',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    // Sunday → Saturday. August opens on a Saturday, so Week 1 is a single day.
    weekStartsOn: 0,
    // Dumbbell and hammer are the same implement, different grip — palms up vs
    // palms in. Coupon replaced barbell: hardly any PAX owns a bar, and every
    // AO has cinder blocks. Spelled out rather than abbreviated so nobody has
    // to decode "DB" mid-workout.
    exercises: [
      { id: 'dumbbell-curl', name: 'Dumbbell Curl', shortName: 'Dumbbell', plural: 'dumbbell curls' },
      { id: 'coupon-curl',   name: 'Coupon Curl',   shortName: 'Coupon',   plural: 'coupon curls', loadHands: 1 },
      { id: 'hammer-curl',   name: 'Hammer Curl',   shortName: 'Hammer',   plural: 'hammer curls'   },
      { id: 'chin-up',       name: 'Chin-Up',       shortName: 'Chin-Up',  plural: 'chin-ups', bodyweight: true },
    ],
    // 300 over a 7-day week is 50/day with a rest day built in — so the short
    // weeks at either end are priced at that same 50/day rather than prorated
    // against 300, and nobody gets a harder week for a shorter one.
    weeks: [
      { startDate: '2026-08-01', endDate: '2026-08-01', target: 50  },
      { startDate: '2026-08-02', endDate: '2026-08-08', target: 300 },
      { startDate: '2026-08-09', endDate: '2026-08-15', target: 300 },
      { startDate: '2026-08-16', endDate: '2026-08-22', target: 300 },
      { startDate: '2026-08-23', endDate: '2026-08-29', target: 300 },
      { startDate: '2026-08-30', endDate: '2026-08-31', target: 100 },
    ],
    guidance: [
      'Break it up however you want — the week is the only deadline.',
      'Dumbbell and hammer are the same weight, different grip: palms up is a dumbbell curl, palms facing each other is a hammer curl. Hammer hits more forearm. No dumbbells? A coupon curls just fine.',
      'Quality reps. Use a weight that leaves 1–3 reps in reserve on most sets.',
      'Take at least one full rest day each week.',
      'If your elbows or forearms feel beat up, prioritize full range of motion. Don\'t swing the weight.',
    ],
    bonusChallenge: {
      name: 'Bonus Round',
      // One entry per bonus week. Each stays locked behind the reveal card
      // until its week starts, so nothing spoils ahead of time — add the next
      // week's object whenever it's decided.
      weeks: [
        {
          startDate: '2026-08-02',
          endDate: '2026-08-08',
          description: '5 sets of 20 rows. Bent-over, single-arm, inverted — dealer\'s choice. Work it in any time this week.',
          feedPostTemplates: [
            '@{name} pulled 100 rows across 5 sets. Bonus Round 1 in the books. 🚣 {hashtag}',
            '5 sets of 20. @{name} handled the rows and earned Bonus Round 1. 💪 {hashtag}',
            '@{name} balanced out all that curling with 100 rows. Bonus Round 1 done. 🔥 {hashtag}',
            'Pull day delivered. @{name} knocked out 5×20 rows for Bonus Round 1. 🚣 {hashtag}',
          ],
        },
        {
          startDate: '2026-08-09',
          endDate: '2026-08-15',
          description: '5 sets of 20 tricep extensions. Overhead, skull crushers, kickbacks — dealer\'s choice. Work it in any time this week.',
          feedPostTemplates: [
            '@{name} pressed out 100 tricep extensions across 5 sets. Bonus Round 2 in the books. 💪 {hashtag}',
            '5 sets of 20. @{name} handled the tricep extensions and earned Bonus Round 2. 🔥 {hashtag}',
            '@{name} gave the biceps a rest and hit 100 tricep extensions. Bonus Round 2 done. 💪 {hashtag}',
            'Back of the arm, front of the line. @{name} knocked out 5×20 tricep extensions for Bonus Round 2. 🏋️ {hashtag}',
          ],
        },
      ],
    },
    // The Bedrock Bicep runs the whole ladder — the band-app reaction emoji,
    // earned. The medal stays so the rungs still read at a glance.
    trophyStyle: {
      emoji: { participant: '💪', bronze: '🥉💪', silver: '🥈💪', gold: '🥇💪' },
      // Real artwork, used only where the mark renders large (trophy case,
      // badge detail, celebrations). Falls back to the emoji above if a file
      // is missing, so declaring these is safe either way.
      iconUrl: {
        participant: '/challenges/aug-2026/bicep-participant.png',
        bronze:      '/challenges/aug-2026/bicep-bronze.png',
        silver:      '/challenges/aug-2026/bicep-silver.png',
        gold:        '/challenges/aug-2026/bicep-gold.png',
      },
      label: {
        participant: 'Bedrock Bicep',
        bronze: 'Bronze Bicep',
        silver: 'Silver Bicep',
        gold: 'Gold Bicep',
      },
    },
    badges: [
      {
        id: 'aug-2026-bedrock-bicep',
        name: 'The Bedrock Bicep',
        emoji: '💪',
        description: 'Hit the weekly curl target every single week of August. The real one.',
        howTo: 'Reach the rep target for every week of the Bedrock Bicep Challenge — topping up a past week counts.',
        criteria: { type: 'complete-challenge' },
      },
      {
        id: 'aug-2026-century-curl',
        name: 'Century Curl',
        emoji: '💯',
        description: '100 curls between sunrise and sunset. One day, one hundred.',
        howTo: 'Log 100 or more reps in a single day of the Bedrock Bicep Challenge.',
        criteria: { type: 'single-day-reps', reps: 100 },
      },
      {
        id: 'aug-2026-four-way-flex',
        name: 'Four-Way Flex',
        emoji: '🔀',
        description: 'Dumbbell, coupon, hammer, chin-up — every variation inside one week.',
        howTo: 'Log all four curl variations within a single week of the challenge.',
        criteria: { type: 'week-variety' },
      },
      {
        id: 'aug-2026-chin-music',
        name: 'Chin Music',
        emoji: '🎺',
        description: '100 chin-ups. The hardest way to get your reps in.',
        howTo: 'Log 100 chin-ups across the Bedrock Bicep Challenge.',
        criteria: { type: 'exercise-reps', exerciseId: 'chin-up', reps: 100 },
      },
      {
        id: 'aug-2026-ahead-of-the-curl',
        name: 'Ahead of the Curl',
        emoji: '⏱️',
        description: 'Finished a week with two days still on the clock.',
        howTo: 'Hit a full week\'s rep target with 2 or more days left in that week.',
        criteria: { type: 'week-early', daysEarly: 2 },
      },
      {
        id: 'aug-2026-sleeve-buster',
        name: 'Sleeve Buster',
        emoji: '🧨',
        description: '2,000 curls in a month. The shirts don\'t fit anymore.',
        howTo: 'Bank 2,000 total reps across the Bedrock Bicep Challenge — 650 past the finish line.',
        criteria: { type: 'challenge-reps', reps: 2000 },
      },
    ],
    featuredBadgeId: 'aug-2026-bedrock-bicep',
    copy: {
      welcomeTagline: 'The Bedrock Bicep, earned. 300 curls a week — dumbbell, coupon, hammer, chin-ups. Any mix, any day, your call. 💪',
      feedPost: {
        // Weekly-cumulative challenges post on the week, not the day (see
        // weekCompleteFeedPost) — these cover the trophy and badge moments.
        regular: [
          '@{name} is putting in Bedrock Bicep work. 💪 {hashtag}',
          '@{name} added to the pile. The Bedrock Bicep doesn\'t build itself. 💪 {hashtag}',
        ],
      },
    },
  },
  {
    // F3 Sactown's first challenge on the app — Babe's 100-merkins-a-day for
    // August. Flat target every day, so it's a single weekly tier spanning the
    // whole month rather than an escalating multiplier.
    id: 'aug-2026-sactown',
    name: 'Sactown Century',
    hashtag: '#SactownCentury',
    tagline: 'A hundred a day, the Sactown way.',
    month: 8,
    year: 2026,
    regionIds: ['sactown'],
    type: 'weekly-tiers',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    exercises: [
      { id: 'merkin', name: 'Merkin', shortName: 'Merkin' },
    ],
    weeklyTiers: [
      { startDay: 1, endDay: 31, targets: [{ exerciseId: 'merkin', amount: 100 }] },
    ],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Regions a challenge belongs to. No `regionIds` means Bedrock-only, so every
 *  challenge written before regions existed keeps working untouched. */
export function challengeRegionIds(c: ChallengeTemplate): string[] {
  return c.regionIds ?? [DEFAULT_REGION_ID]
}

export function challengeBelongsToRegion(c: ChallengeTemplate, regionId: string): boolean {
  return challengeRegionIds(c).includes(regionId)
}

/** Every challenge a region runs, in definition order. Use this anywhere you'd
 *  otherwise scan CHALLENGES directly — otherwise a region sees another
 *  region's history in past-challenge lists, badges, and achievements. */
export function challengesForRegion(regionId: string): ChallengeTemplate[] {
  return CHALLENGES.filter(c => challengeBelongsToRegion(c, regionId))
}

/** Returns the challenge active on a given date for a region, or undefined.
 *  Two regions can run different challenges over the same dates, so the region
 *  is required — there is no such thing as "the" challenge for a date. */
export function getChallengeForDate(date: string, regionId: string): ChallengeTemplate | undefined {
  return CHALLENGES.find(
    c => date >= c.startDate && date <= c.endDate && challengeBelongsToRegion(c, regionId)
  )
}

/** Returns a region's active challenge today (PT date). */
export function getCurrentChallenge(regionId: string): ChallengeTemplate | undefined {
  return getChallengeForDate(getTodayPT(), regionId)
}

/** Lookup by id, deliberately not region-scoped — used to resolve a challenge
 *  a user already has a badge or log for. */
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

  // 'weekly-cumulative': no daily quota at all. Every exercise is listed with a
  // target of 0 so rep entry still knows which movements are on the menu, and
  // `isOpenEnded` tells the UI to show week progress instead of a daily ring.
  if (challengeType === 'weekly-cumulative') {
    return {
      date,
      day,
      isRestDay: false,
      isOpenEnded: true,
      totalReps: 0,
      repsPerExercise: 0,
      exercises: challenge.exercises.map(ex => ({ exercise: ex, reps: 0 })),
    }
  }

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
  // Weekly-cumulative challenges carry no daily target — the month is the sum
  // of the weekly ones.
  if (challenge.type === 'weekly-cumulative') return getChallengeRepTotal(challenge)
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

/** PT calendar date (YYYY-MM-DD) of an ISO timestamp; null if missing/invalid. */
export function ptDateOf(iso?: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
}

/**
 * Required challenge days a PAX skipped between their last completed day and
 * `until`, both exclusive. Rest days never count against anyone, so a holiday
 * can't make someone look like they went missing. Used by the "comeback" copy
 * on both the feed and the push notifications — keep it in one place so the
 * two never disagree about who's been away.
 */
export function daysMissedBetween(
  challenge: ChallengeTemplate,
  lastDone: string,
  until: string,
): number {
  return getChallengeDates(challenge)
    .filter(d => d > lastDone && d < until && !isRestDay(challenge, d))
    .length
}

/** A PAX's standing on the rep board. */
export interface Standing {
  id: string
  name: string
  reps: number
}

/**
 * Who a PAX overtook when their rep total went from `repsBefore` to
 * `repsAfter`, nearest first.
 *
 * Anyone level with them beforehand counts as passed — breaking a tie by
 * pulling ahead is an overtake. Returns nothing when the total didn't move,
 * so re-saving a finished day can't manufacture a pass.
 */
export function paxPassed(
  standings: Standing[],
  moverId: string,
  repsBefore: number,
  repsAfter: number,
): Standing[] {
  if (repsAfter <= repsBefore) return []
  return standings
    .filter(s => s.id !== moverId && s.reps >= repsBefore && s.reps < repsAfter)
    .sort((a, b) => b.reps - a.reps)
}

/**
 * A PAX counts as "away" once they've skipped this many required days in a
 * row. Shared by the comeback feed post and the comeback push notification —
 * if these ever drifted apart, the feed would welcome someone back on a day
 * the reminder still treated as business as usual.
 */
export const AWAY_THRESHOLD = 3

/** The parts of a daily log that say when it was finished. Every timestamp is
 *  optional — logs written by older builds may carry none of them, and those
 *  simply don't count toward either signal. */
export interface CompletionLogInput {
  completionFraction: number
  loggedAt?: string
  updatedAt?: string
  completedAt?: string
}

/** When a day was actually finished — matches the same-day stack badges. */
export function logFinishedAt(log: CompletionLogInput): string | undefined {
  return log.completedAt ?? log.updatedAt ?? log.loggedAt
}

/**
 * Personal context behind the "stacked" and "comeback" copy: how many full
 * days this PAX finished during `today`, and how many required days they'd
 * been away before it.
 *
 * Both are measured by when a day was *finished*, not which challenge day it
 * was. Someone who spent yesterday backfilling Day 3 was active yesterday —
 * measuring by the log's own date would call them a week absent.
 *
 * Shared by the completion feed post and the push notifications so the two can
 * never disagree about who stacked or who's been gone.
 */
export function completionContext(
  challenge: ChallengeTemplate,
  logs: CompletionLogInput[],
  today: string,
): { stackedDays: number; daysAway: number } {
  let stackedDays = 0
  let lastActive: string | null = null
  for (const log of logs) {
    if (log.completionFraction < 1) continue
    const doneOn = ptDateOf(logFinishedAt(log))
    if (doneOn === today) stackedDays++
    else if (doneOn && (!lastActive || doneOn > lastActive)) lastActive = doneOn
  }
  return {
    stackedDays,
    daysAway: lastActive ? daysMissedBetween(challenge, lastActive, today) : 0,
  }
}

// ─── Weekly scoping ─────────────────────────────────────────────────────────
// The leaderboard's "This Week" view and the weekly competitive notifications
// both slice the challenge by calendar week. A fresh weekly board every Sunday
// is the whole point: a PAX who joins three-quarters of the way through the
// month can still win THIS week, so they feel like a real contender instead of
// someone who can never catch the month-long rep leaders. Keep the week
// definition in one place so the UI and the Cloud Functions rank identically.

/**
 * Returns the YYYY-MM-DD of the week-start on or before `date` (PT calendar week).
 * `weekStartsOn` is 0=Sunday (default, matches the weekly-recap default day) … 6=Saturday.
 * Date-only math via noon-UTC so it's stable in any runtime timezone.
 */
export function getWeekStartPT(date: string, weekStartsOn = 0): string {
  const d = new Date(date + 'T12:00:00Z')
  const dow = d.getUTCDay() // 0=Sun … 6=Sat — the weekday of the calendar date
  const diff = (dow - weekStartsOn + 7) % 7
  d.setUTCDate(d.getUTCDate() - diff)
  return d.toISOString().slice(0, 10)
}

/**
 * The dates of the current calendar week that fall inside the challenge and are
 * on/before `today` — i.e. the days that count toward this week's board so far.
 *
 * Defaults to the challenge's own `weekStartsOn` so the leaderboard, the week
 * card, and the Cloud Functions all slice the calendar identically.
 */
export function getCurrentWeekDates(challenge: ChallengeTemplate, today: string, weekStartsOn?: number): string[] {
  const weekStart = getWeekStartPT(today, weekStartsOn ?? challenge.weekStartsOn ?? 0)
  return getChallengeDates(challenge).filter(d => d >= weekStart && d <= today)
}

// ─── Weekly-cumulative engine ───────────────────────────────────────────────
// A weekly-cumulative challenge has no daily quota: you owe the *week* a rep
// total and fill it however you like. Weeks are declared explicitly on the
// template (see ChallengeWeek) so a challenge can open or close mid-week with a
// prorated target, or escalate its target week over week, as pure data.

/** True when the challenge scores by pooled weekly reps rather than by day. */
export function isWeeklyCumulative(challenge: ChallengeTemplate): boolean {
  return challenge.type === 'weekly-cumulative'
}

/** Every declared week, resolved with its 1-based index and day count. */
export function getChallengeWeeks(challenge: ChallengeTemplate): ResolvedWeek[] {
  return (challenge.weeks ?? []).map((w, i) => ({
    ...w,
    index: i + 1,
    dayCount: Math.round(
      (new Date(w.endDate + 'T12:00:00Z').getTime() - new Date(w.startDate + 'T12:00:00Z').getTime())
      / 86_400_000,
    ) + 1,
  }))
}

/** The week containing `date`, or undefined when the date sits outside them all. */
export function getChallengeWeek(challenge: ChallengeTemplate, date: string): ResolvedWeek | undefined {
  return getChallengeWeeks(challenge).find(w => date >= w.startDate && date <= w.endDate)
}

/** Reps banked across every exercise in a set of logs. */
export function sumLogReps(logs: RepLogInput[]): number {
  return logs.reduce(
    (sum, l) => sum + (l.exerciseLogs ?? []).reduce((s, e) => s + (e.completedReps ?? 0), 0),
    0,
  )
}

/** The parts of a daily log the weekly engine reads. */
export interface RepLogInput {
  date: string
  exerciseLogs?: Array<{ exerciseId: string; completedReps: number }>
}

/**
 * Where a PAX stands in the week containing `date`.
 *
 * `logs` may be the user's whole challenge history — only the ones inside the
 * week are counted, so callers never have to pre-filter. Returns null when the
 * date falls outside every declared week.
 */
export function getWeekProgress(
  challenge: ChallengeTemplate,
  date: string,
  logs: RepLogInput[],
  today = date,
): WeekProgress | null {
  const week = getChallengeWeek(challenge, date)
  if (!week) return null

  const reps = sumLogReps(logs.filter(l => l.date >= week.startDate && l.date <= week.endDate))
  const target = week.target
  const remaining = Math.max(0, target - reps)

  // Days still available, today included. A week already in the past has none;
  // a week that hasn't started yet offers all of them.
  const daysLeft = today > week.endDate
    ? 0
    : today < week.startDate
    ? week.dayCount
    : Math.round(
        (new Date(week.endDate + 'T12:00:00Z').getTime() - new Date(today + 'T12:00:00Z').getTime())
        / 86_400_000,
      ) + 1

  return {
    week,
    reps,
    target,
    fraction: target > 0 ? Math.min(1, reps / target) : 0,
    remaining,
    daysLeft,
    perDayNeeded: remaining > 0 && daysLeft > 0 ? Math.ceil(remaining / daysLeft) : 0,
    isComplete: reps >= target,
  }
}

/** Progress for every week up to and including the one containing `today`. */
export function getWeeklyHistory(
  challenge: ChallengeTemplate,
  today: string,
  logs: RepLogInput[],
): WeekProgress[] {
  return getChallengeWeeks(challenge)
    .filter(w => w.startDate <= today)
    .map(w => getWeekProgress(challenge, w.startDate, logs, today))
    .filter((w): w is WeekProgress => w !== null)
}

/** Weeks whose target this PAX has hit — the trophy/streak unit for these challenges. */
export function getWeeksCompleted(
  challenge: ChallengeTemplate,
  today: string,
  logs: RepLogInput[],
): number {
  return getWeeklyHistory(challenge, today, logs).filter(w => w.isComplete).length
}

/** Sum of every declared week's target — the whole challenge in reps. */
export function getChallengeRepTotal(challenge: ChallengeTemplate): number {
  return (challenge.weeks ?? []).reduce((sum, w) => sum + w.target, 0)
}

/**
 * Consecutive weeks hitting target, counting back from the most recent *ended*
 * week. The week in progress only extends the streak once it's actually
 * complete, so a Monday morning can't break a streak that's still winnable.
 */
export function getWeekStreak(
  challenge: ChallengeTemplate,
  today: string,
  logs: RepLogInput[],
): number {
  const history = getWeeklyHistory(challenge, today, logs)
  let streak = 0
  for (let i = history.length - 1; i >= 0; i--) {
    const w = history[i]
    if (w.isComplete) { streak++; continue }
    // An unfinished week that hasn't ended yet is not a break — skip past it.
    if (w.week.endDate >= today) continue
    break
  }
  return streak
}

// ─── Load (weight used) ─────────────────────────────────────────────────────

/** Compact badge for a load: "2×25", "1×35", "65 lb", "BW". Null when unset. */
export function formatLoad(load?: ExerciseLoad | null): string | null {
  if (!load) return null
  if (load.bodyweight && !load.lbs) return 'BW'
  if (!load.lbs || load.lbs <= 0) return null
  return load.hands ? `${load.hands}×${load.lbs}` : `${load.lbs} lb`
}

/** Spoken form for notification/feed copy: "a pair of 25s", "65 lb", "bodyweight". */
export function describeLoad(load?: ExerciseLoad | null): string | null {
  if (!load) return null
  if (load.bodyweight && !load.lbs) return 'bodyweight'
  if (!load.lbs || load.lbs <= 0) return null
  if (load.hands === 2) return `a pair of ${load.lbs}s`
  if (load.hands === 1) return `a single ${load.lbs}`
  return `${load.lbs} lb`
}

/**
 * The load to show for a PAX: the most recent one they set. Logs may arrive in
 * any order, so this scans rather than assuming the array is sorted.
 *
 * Superseded by `badgeLoad()` for the leaderboard now that a day holds many
 * weights; still used where "what were they on last" is the actual question.
 */
export function latestLoad<T extends { date: string; load?: ExerciseLoad }>(
  logs: T[],
): ExerciseLoad | undefined {
  let best: T | undefined
  for (const log of logs) {
    if (!log.load) continue
    if (!best || log.date > best.date) best = log
  }
  return best?.load
}

// ─── Sets ───────────────────────────────────────────────────────────────────
// A day is a list of sets; `exerciseLogs` and the day-level `load` are rollups
// written from them. Everything here treats a missing `sets` array as a legacy
// log and falls back to those rollups, so nothing needs migrating.

/**
 * Total pounds in play for one rep: a pair of 20s moves 40, and so does a
 * single 40 lb coupon. Comparing on the total is what makes "2×20" and "1×40"
 * rank as the same effort instead of one arbitrarily beating the other.
 */
export function loadTotalLbs(load?: ExerciseLoad | null): number {
  if (!load?.lbs || load.lbs <= 0) return 0
  return load.lbs * (load.hands ?? 1)
}

/** Reps per exercise id, for writing the `exerciseLogs` rollup. */
export function rollupSetReps(sets: LoggedSet[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const s of sets) {
    if (s.reps <= 0) continue
    out[s.exerciseId] = (out[s.exerciseId] ?? 0) + s.reps
  }
  return out
}

/**
 * The weight a PAX has actually been moving: whichever they did the most reps
 * at, heaviest winning a tie.
 *
 * Deliberately not "heaviest" — one token rep at 2×50 shouldn't outrank three
 * hundred at 2×25, which is what the badge claims to be showing. Nor "latest",
 * which flip-flopped every time someone warmed up light.
 */
export function badgeLoad(sets: LoggedSet[]): ExerciseLoad | undefined {
  const buckets = new Map<string, { load: ExerciseLoad; reps: number }>()
  for (const s of sets) {
    if (!s.load || s.reps <= 0 || !formatLoad(s.load)) continue
    const key = `${s.load.lbs ?? 0}:${s.load.hands ?? 0}:${s.load.bodyweight ? 1 : 0}`
    const found = buckets.get(key)
    if (found) found.reps += s.reps
    else buckets.set(key, { load: s.load, reps: s.reps })
  }
  let best: { load: ExerciseLoad; reps: number } | undefined
  for (const b of buckets.values()) {
    if (!best) { best = b; continue }
    if (b.reps > best.reps) best = b
    else if (b.reps === best.reps && loadTotalLbs(b.load) > loadTotalLbs(best.load)) best = b
  }
  return best?.load
}

/** One weight a PAX worked at, and how much of their work happened there. */
export interface WeightTally {
  /** The badge form — "2×25", "1×40" — and the group's identity. */
  badge: string
  load: ExerciseLoad
  reps: number
  /** Pounds moved at this weight. */
  volume: number
}

/**
 * Reps grouped by the weight they were done at, heaviest first. Unweighted
 * sets are left out — "no weight" isn't a weight, and a bodyweight row would
 * read as a zero next to real ones.
 */
export function setsByWeight(sets: LoggedSet[]): WeightTally[] {
  const groups = new Map<string, WeightTally>()
  for (const s of sets) {
    const badge = formatLoad(s.load)
    if (!badge || !s.load || s.reps <= 0) continue
    const found = groups.get(badge)
    if (found) {
      found.reps += s.reps
      found.volume += s.reps * loadTotalLbs(s.load)
    } else {
      groups.set(badge, {
        badge,
        load: s.load,
        reps: s.reps,
        volume: s.reps * loadTotalLbs(s.load),
      })
    }
  }
  return [...groups.values()].sort((a, b) => loadTotalLbs(b.load) - loadTotalLbs(a.load))
}

/** One variation done at one weight — a single row of the week's mix. */
export interface ExerciseWeightTally {
  exerciseId: string
  /** Badge form: "2×15", "BW", or null when the reps carried no weight. */
  badge: string | null
  load?: ExerciseLoad
  reps: number
  /** Pounds moved on this row. */
  volume: number
}

/**
 * The week's reps cut by variation *and* the weight they were done at, so
 * switching dumbbells mid-week shows up as two rows rather than being averaged
 * into one badge or split into a second table that doesn't reconcile.
 *
 * Rows of the same variation stay together — ordered by that variation's total,
 * heaviest first within it — so a bigger variation can't wedge between them.
 * Bodyweight movements get a "BW" row and are counted, unlike `setsByWeight()`,
 * which is about weights alone and drops them.
 */
export function setsByExerciseWeight(
  sets: LoggedSet[],
  exercises: Exercise[] = [],
): ExerciseWeightTally[] {
  const bodyweight = bodyweightIds(exercises)
  const groups = new Map<string, ExerciseWeightTally>()
  const totals = new Map<string, number>()

  for (const s of sets) {
    if (s.reps <= 0) continue
    const isBodyweight = bodyweight.has(s.exerciseId)
    const load = isBodyweight ? undefined : s.load
    const badge = isBodyweight ? 'BW' : formatLoad(load)
    totals.set(s.exerciseId, (totals.get(s.exerciseId) ?? 0) + s.reps)

    const key = `${s.exerciseId}::${badge ?? ''}`
    const found = groups.get(key)
    if (found) {
      found.reps += s.reps
      found.volume += s.reps * loadTotalLbs(load)
    } else {
      groups.set(key, {
        exerciseId: s.exerciseId,
        badge,
        ...(load ? { load } : {}),
        reps: s.reps,
        volume: s.reps * loadTotalLbs(load),
      })
    }
  }

  return [...groups.values()].sort((a, b) => {
    if (a.exerciseId !== b.exerciseId) {
      const byTotal = (totals.get(b.exerciseId) ?? 0) - (totals.get(a.exerciseId) ?? 0)
      return byTotal !== 0 ? byTotal : a.exerciseId.localeCompare(b.exerciseId)
    }
    return loadTotalLbs(b.load) - loadTotalLbs(a.load)
  })
}

/** Pounds moved: reps × total weight, summed. Unweighted sets count zero. */
export function setsVolume(sets: LoggedSet[]): number {
  return sets.reduce((sum, s) => sum + Math.max(0, s.reps) * loadTotalLbs(s.load), 0)
}

/**
 * Exercises that can't carry a weight, by id. Cheap enough to rebuild per call,
 * and passing the list stays optional so old call sites keep working.
 */
function bodyweightIds(exercises?: Exercise[]): Set<string> {
  return new Set((exercises ?? []).filter(e => e.bodyweight).map(e => e.id))
}

/** Drops a load a bodyweight movement should never have had. */
function unweighted(set: LoggedSet): LoggedSet {
  if (!set.load) return set
  const out = { ...set }
  delete out.load
  return out
}

/**
 * A log's sets, inventing them for logs written before sets existed: one set
 * per exercise, carrying whatever single weight the day had. Every reader goes
 * through this rather than touching `.sets` directly.
 *
 * Pass `exercises` and bodyweight movements are stripped of any weight. A
 * legacy log holds one weight for the *whole day*, so synthesizing sets from it
 * hands the day's dumbbells to the chin-ups too — which then double-counts into
 * the by-weight tallies and inflates the pounds moved. Scrubbing on the way out
 * fixes those logs and any log that had the bad set list written back to it.
 */
export function logSets<T extends {
  sets?: LoggedSet[]
  load?: ExerciseLoad
  loggedAt?: string
  date?: string
  exerciseLogs?: Array<{ exerciseId: string; completedReps: number }>
}>(log: T, exercises?: Exercise[]): LoggedSet[] {
  const bodyweight = bodyweightIds(exercises)
  const scrub = (sets: LoggedSet[]) =>
    bodyweight.size === 0 ? sets : sets.map(s => (bodyweight.has(s.exerciseId) ? unweighted(s) : s))

  if (log.sets?.length) return scrub(log.sets)
  const at = log.loggedAt ?? (log.date ? `${log.date}T12:00:00.000Z` : new Date(0).toISOString())
  return scrub(
    (log.exerciseLogs ?? [])
      .filter(el => el.completedReps > 0)
      .map(el => ({
        exerciseId: el.exerciseId,
        reps: el.completedReps,
        ...(log.load ? { load: log.load } : {}),
        at,
      })),
  )
}

/** The weight this exercise was most recently done at, if any. */
function lastSetLoad(sets: LoggedSet[]): ExerciseLoad | undefined {
  for (let i = sets.length - 1; i >= 0; i--) if (sets[i].load) return sets[i].load
  return undefined
}

/**
 * Bring a set list in line with a reps map.
 *
 * Not every writer thinks in sets — Catch Up, the make-up pickers and the
 * day-log modal all hand over "this exercise now totals N". Rather than make
 * each one build sets (and get it subtly wrong), the save path runs everything
 * through here, so a log's sets and its `exerciseLogs` rollup cannot drift
 * apart no matter who wrote it.
 *
 * Topping an exercise up appends one set at whatever weight that exercise was
 * last done at — a Catch Up on a day you curled 2×20 is 2×20. Editing down
 * trims the newest sets first, the way undo would.
 */
export function reconcileSets(
  reps: Record<string, number>,
  existing: LoggedSet[],
  at: string,
): LoggedSet[] {
  const byExercise = new Map<string, LoggedSet[]>()
  for (const s of existing) {
    const list = byExercise.get(s.exerciseId) ?? []
    list.push(s)
    byExercise.set(s.exerciseId, list)
  }

  const out: LoggedSet[] = []
  for (const id of new Set([...Object.keys(reps), ...byExercise.keys()])) {
    const want = Math.max(0, reps[id] ?? 0)
    if (want === 0) continue
    const have = byExercise.get(id) ?? []
    const total = have.reduce((sum, s) => sum + s.reps, 0)

    if (total === want) { out.push(...have); continue }

    if (want > total) {
      const load = lastSetLoad(have)
      out.push(...have, { exerciseId: id, reps: want - total, ...(load ? { load } : {}), at })
      continue
    }

    let room = want
    for (const s of have) {
      if (room <= 0) break
      out.push(s.reps <= room ? s : { ...s, reps: room })
      room -= Math.min(s.reps, room)
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at))
}

/** Every set across a batch of logs, oldest first. */
export function allSets<T extends Parameters<typeof logSets>[0] & { date?: string }>(
  logs: T[],
  exercises?: Exercise[],
): LoggedSet[] {
  return logs
    .flatMap(l => logSets(l, exercises))
    .sort((a, b) => a.at.localeCompare(b.at))
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
 * How many bonus weeks the challenge is expected to end up with — what
 * "completed every bonus week" has to be measured against.
 *
 * A round is usually announced partway through the week it covers, so the
 * declared list trails reality all month: counting it alone would call a PAX
 * done after the very first one. Every week that hasn't ended yet is assumed
 * to be getting a bonus, so the count only settles once the challenge is over
 * — which is what keeps Bonus Hunter from landing in week one.
 */
export function expectedBonusWeeks(challenge: ChallengeTemplate, today: string): number {
  if (!challenge.bonusChallenge) return 0
  const declared = challenge.bonusChallenge.weeks
  if (today > challenge.endDate) return declared.length
  const weeks = getChallengeWeeks(challenge)
  // A challenge with no week structure gives nothing to project from; assume
  // at least one more round is coming while it's still running.
  if (weeks.length === 0) return declared.length + 1
  const uncovered = weeks.filter(w =>
    w.endDate >= today
    && !declared.some(b => b.startDate <= w.endDate && b.endDate >= w.startDate)
  ).length
  return declared.length + uncovered
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

/**
 * Feed post for finishing a week of a weekly-cumulative challenge. This fires
 * once per PAX per week — the day-completion posts don't apply, because on
 * these challenges every day with a single rep in it is "complete".
 */
export function weekCompleteFeedPost(input: {
  name: string
  challenge: ChallengeTemplate
  week: WeekProgress
  isMakeUp?: boolean
}): string {
  const { name, challenge, week, isMakeUp } = input
  const handle = `@${name}`
  const tag = challenge.hashtag
  const target = week.target.toLocaleString()
  const n = week.week.index

  if (isMakeUp) {
    return pickOne([
      `${handle} went back and finished Week ${n} — all ${target} of them. No week left behind. 💪 ${tag}`,
      `Books balanced. ${handle} topped up Week ${n} to ${target}. Late, but logged. 💪 ${tag}`,
      `${handle} refused to leave Week ${n} short. ${target} in the bank. 💪 ${tag}`,
    ])
  }

  const earlyBird = week.daysLeft >= 3
    ? [
        `${handle} closed out Week ${n} with ${week.daysLeft} days to spare. ${target} done. 💪💪 ${tag}`,
        `Week ${n}: finished early. ${handle} banked ${target} and still has ${week.daysLeft} days on the clock. 💪 ${tag}`,
      ]
    : []

  return pickOne([
    ...earlyBird,
    `${handle} put ${target} in the bank — Week ${n} complete. 💪 ${tag}`,
    `Week ${n} done. ${handle} hit ${target}. Sleeves are getting tight. 💪 ${tag}`,
    `${target}, handled. ${handle} closed Week ${n}. 💪 ${tag}`,
    `${handle} finished Week ${n} — ${target} across the week. Who else is getting there? ${tag} 💪`,
    `Week ${n} belongs to ${handle}. ${target} banked. 💪 ${tag}`,
    `The Bedrock Bicep grows. ${handle} closed Week ${n} — ${target}. 💪 ${tag}`,
    `${handle} earned the 💪 this week. Week ${n}, ${target} reps. ${tag}`,
  ])
}

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
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
