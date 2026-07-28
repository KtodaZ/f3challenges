/**
 * Participant-facing changelog — the single source of truth for "What's New".
 *
 * These are curated, plain-English notes written FOR the PAX, not raw commit
 * messages. Keep each bullet short and about something a user would actually
 * notice. Newest entry goes FIRST.
 *
 * Per project rule (see CLAUDE.md): every change that ships something a PAX
 * could notice adds a bullet here — either to today's entry or a new one.
 */

export interface ChangelogEntry {
  /** Ship date, YYYY-MM-DD. */
  date: string
  /** Short, user-facing notes. Keep them plain-English — no commit-speak. */
  changes: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-07-28',
    changes: [
      'Dropped the sarcastic feed posts that kicked in past the halfway mark of a challenge — no more “somebody check on @PAX, that’s not normal behavior” when you log a day. Posts for a finished day now read the same all month.',
    ],
  },
  {
    date: '2026-07-27',
    changes: [
      'The leaderboard now opens on a “This Week” board that resets every Sunday. Just joined mid-month? You’re instantly in the running — stack up reps this week and you can top the board no matter how far into the challenge it is. Your season-long standings are still one tap away under “This Month.”',
      'Competitive nudges (if you’ve turned them on) now mix the weekly board with the month-long race — so you’ll get both “someone’s right on your heels in this week’s leaderboard” and “X reps to pass the season leader.”',
      'This week’s Tour de Bedrock bonus is live: a time trial around the big circle at Divento (Maidu Park). Run it, then post your time with picture proof in the feed. Reveal it on the home screen and tap “Mark Complete” once you’ve done it.',
    ],
  },
  {
    date: '2026-07-24',
    changes: [
      'Making up a missed day is now a swipe. From today’s card on the home screen, swipe left to step back through the days you still owe and quick-tap them in — no more opening a form for every day. Each missed day shows its date and switches to an amber look so it’s obvious you’re logging a past day, not today.',
      'Behind a lot of days? Tap “Jump to a day” to hop straight to any missed day instead of swiping through them one by one.',
      'Challenges from past months that you never finished are now tucked into a collapsible section at the bottom of the home screen, so they stay out of the way until you want to catch them up.',
      'Your day’s completion percentage is now exact — it tracks the actual reps you’ve done instead of rounding to the nearest quarter. Log 7 of 10 and you’ll see 70%, not 75%. (Days you finished still read 100%, and past days keep the number they were saved with.)',
      'Tidied up the top of the home screen: today’s progress dial and your daily pep-talk are now a single card, and the extra “Update” button is gone — just quick-tap the exercises to log.',
    ],
  },
  {
    date: '2026-07-23',
    changes: [
      'Profiles now open with a “Today” card — an at-a-glance look at what that PAX has already knocked out today and what’s still left on the board.',
      'The leaderboard’s “Who needs a push?” now tells you *why* each PAX made the list — a quick note under every name, like “Almost done today — 70% of the way there,” “Hasn’t done a rep in 2 days,” or “3-day streak on the line.”',
      '“Who needs a push?” is now ordered, not just a list: the PAX closest to finishing sit up top for a quick win, working down to the ones who’ve gone quietest — weighing how far they got today, how long they’ve been idle, whether a streak’s about to break, and how long it’s been since anyone gave them a shoutout.',
    ],
  },
  {
    date: '2026-07-22',
    changes: [
      'The leaderboard now shows only PAX taking part in this month’s challenge — no more inactive or opted-out names cluttering the board.',
      'The leaderboard’s Group Activity is now swipeable: a line chart of the group’s total reps per day, a chart of what % of PAX finished each day, and the classic completion grid — swipe between them.',
      'Group stats now count only PAX actually in the challenge, and the middle stat shows the group’s average completion % instead of a “perfect days” count that nobody could realistically hit this far into the month.',
      'New opt-in “Competitive Nudges”: turn them on to get rank-based reminders like “100 reps to pass Splice for #3.” Off by default — flip it on in Settings → Notifications, during onboarding, or from the prompt on the leaderboard. Turn it off any time.',
    ],
  },
  {
    date: '2026-07-20',
    changes: [
      'Fixed the 💬 Conversationalist badge — your feed comments are counted again, so it now unlocks once you hit 25.',
      'Four new badges for lighting up the feed: 📸 Pics or It Didn\'t Happen (first photo), 📷 Shutterbug (5 photos), 🎬 Lights, Camera, Merkin (first video), and 🎞️ Director\'s Cut (3 videos).',
    ],
  },
  {
    date: '2026-07-19',
    changes: [
      'You can now add a video to a feed post, picked straight from your phone. It uploads in the background while you finish typing.',
      'Posts with a video show an inline player you can tap to play right in the feed.',
      'Editing a post now lets you add or swap its video too.',
    ],
  },
  {
    date: '2026-07-17',
    changes: [
      'You can now add photos to a feed post — up to 8 at once. Pick them straight from your camera roll and they upload while you finish typing.',
      'Posts with photos show a clean grid; tap any photo to open a full-screen, swipeable viewer.',
      'Editing a post now lets you add or remove its photos too.',
      'Photo uploads no longer get stuck spinning — if one fails, it now shows a clear error you can tap to retry.',
      'New trophy: earn the 🧗 Adapt & Overcome badge by finishing a full challenge while your status is set to Modifying — scaling the work still counts as showing up.',
    ],
  },
  {
    date: '2026-07-15',
    changes: [
      'Added this "What\'s New" changelog — tap the version in Settings anytime to see what changed.',
      'Call Out a PAX now only lists guys in the current challenge, so drop-offs no longer clutter the list.',
      'You can now call out several PAX in one shoutout — or tap "The whole crew" to tag and notify everyone in the challenge at once.',
      'The Call Out list is now grouped by today\'s progress — haven\'t started, in progress, finished — so you can nudge a whole group with one tap.',
    ],
  },
  {
    date: '2026-07-12',
    changes: [
      'Your "keep going" nudges now call out the exercises and reps you still have left, not just a rep total.',
    ],
  },
  {
    date: '2026-07-11',
    changes: [
      'The feed now loads endlessly as you scroll, with clear day-by-day separators.',
    ],
  },
  {
    date: '2026-07-10',
    changes: [
      'Lots of new badges to earn — group finishes, same-day stacks, socials, and a Completionist goal.',
      'Tap any badge to see how to earn it, and check the Badge of the Month.',
    ],
  },
  {
    date: '2026-07-08',
    changes: [
      'New Tour de Bedrock Week 3 bonus: the Sierra College Blvd heavy ruck (up and back).',
      'Time-based exercises now have a full-screen timer.',
      'Added a weekly AI recap of the crew\'s week.',
    ],
  },
]

/** Newest entry first — the list is already sorted, this just guards intent. */
export function getChangelog(): ChangelogEntry[] {
  return [...CHANGELOG].sort((a, b) => b.date.localeCompare(a.date))
}

/** The most recent N entries — used by the update modal's "What's New" peek. */
export function getRecentChangelog(limit = 3): ChangelogEntry[] {
  return getChangelog().slice(0, limit)
}

/** "Jul 15, 2026" — changelog spans months, so unlike formatDate we show year. */
export function formatChangelogDate(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
