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
    date: '2026-08-16',
    changes: [
      'Bonus Round 3 is live, and it\'s not about reps: a random act of kindness for your wife or another loved one — flowers, coffee, lunch, your call. Reveal it on the home screen and tap **Mark Complete** any time before Saturday night.',
    ],
  },
  {
    date: '2026-08-13',
    changes: [
      'Finished your day and kept going? There\'s a **Log extra reps** button under your status card now. Tap it, bank whatever you did on top — those reps count on the leaderboard like every other rep. It only ever adds, so nothing you log there can undo the day you already finished, and anything you add by mistake has an ✕ next to it while the box is open.',
    ],
  },
  {
    date: '2026-08-09',
    changes: [
      'New in **Settings → Send Feedback**: report a bug or throw out an idea without tracking anyone down. Say what happened and hit send — the page you were on and your phone details ride along, so nobody has to interrogate you about it.',
      'Bonus Round 2 is live: **5 sets of 20 tricep extensions**. Overhead, skull crushers, kickbacks — your call. Reveal it on the home screen and tap **Mark Complete** any time before Saturday night.',
      'Fixed: **Bonus Hunter** was unlocking after a single bonus round, because it only counted the rounds announced so far. It now assumes a bonus every week of the month, so it stays locked until you\'ve cleared the lot.',
    ],
  },
  {
    date: '2026-08-08',
    changes: [
      'The **Admin** tag is out of the feed — no more tag on posts or on comments, just names. It still sits beside the name on a profile, so if you want to know who runs things, tap through.',
    ],
  },
  {
    date: '2026-08-07',
    changes: [
      'The weight now sits right under the variation chips on the log card, always open — no more tapping "Logging at" to unfold it. Pick your variation, pick your weight, tap your reps, top to bottom. The list of what you\'ve banked underneath now says **Today\'s reps** on it, so it\'s clear those rows are just today.',
      'This week\'s mix is one table now. Each row is a variation *and* the weight you did it at — **Dumbbell 2×15 · 40** — so if you switch dumbbells mid-week you get a row for each. The separate "by weight" list underneath is gone: it was the same reps counted a second way, close enough to your variation totals to look like it should match them when it never did. The rows add up to the number at the top, chin-ups included.',
      'Fixed: chin-ups were being counted as if you did them holding whatever weight the rest of that day was logged at. That padded the weight breakdown and inflated your pounds moved. Chin-ups show **BW** and move nothing now — your rep totals never changed, only the weight they were credited to.',
    ],
  },
  {
    date: '2026-08-04',
    changes: [
      'An **Admin** tag now sits beside the name of anyone who runs the app — on their posts, their comments and their profile. If you\'ve ever wondered who to ask, that\'s who.',
      'Admins can now post and comment in another region\'s feed, so you may see one turn up in yours (spot them by the Admin tag). Nothing they do there counts toward your leaderboard — their reps stay in their own region.',
      'New **Breakdown** on every profile — yours and everybody else’s. Total reps, the weight you usually work at, pounds moved, which variations you actually favour, how your reps split across weights, and your best single day. Tap the 🏋 badge on the leaderboard to jump straight to someone’s.',
      'The weight now rides along with the reps. Set the pad to **2×20** and every tap logs at 2×20; switch to a **1×40** coupon at lunch and those reps log at 1×40. No more one weight for the whole day.',
      'Today’s sets are listed right on the card — **+20 Dumbbell 2×20**, **+25 Coupon 1×40** — and each one has an ✕. Fat-fingered a set three taps ago? Drop that one, keep the rest. (The old single Undo is gone; this does the same job better.)',
      'This week’s mix now shows what you moved as well as what you did: your reps split by weight, plus the total pounds moved for the week.',
      'The leaderboard badge got honest. It shows the weight you’ve done the most reps at instead of whatever you touched last, so one show-off rep at 2×50 no longer outranks three hundred at 2×25.',
    ],
  },
  {
    date: '2026-08-03',
    changes: [
      'Fixed: the weight badge could get stuck. Once it was set, picking a different weight quietly failed to save and the old one hung around no matter what you chose. It changes when you change it now.',
      'Logging curls happens on one card now. The weight you’re swinging sits right under the rep buttons instead of behind a pop-up full of numbers that looked just like the rep buttons — tap a weight, it’s saved; tap it again to drop it. “Other” works the same way: the box opens right where the button was.',
      'The weight strip stopped asking questions it could answer itself. Dumbbell and Hammer are a pair (**2×25**), Coupon is one block (**1×45**), and Chin-Up doesn’t ask at all.',
    ],
  },
  {
    date: '2026-08-01',
    changes: [
      'Inviting a new PAX is a lot easier to text: **f3challenges.com/bedrock** and **f3challenges.com/sactown** drop them straight into the right region. The old link still works if you’ve got it saved.',
      'Reminders now count the same crew the app does. PAX who signed up but never logged a rep no longer pad the “X of Y done” number or get named as someone still owing reps — so the counts in your notifications finally match what you see on the leaderboard.',
      'Your Q can now tidy the roster — moving a PAX who’s stopped posting off the active crew, or fixing a misspelled F3 name. Nothing gets deleted: their logs, badges and posts stay exactly where they are, and they still show up in past challenge results.',
    ],
  },
  {
    date: '2026-07-31',
    changes: [
      'August is **The Bedrock Bicep Challenge** 💪 — 300 curls a week. Dumbbell, coupon, hammer, chin-ups: any mix, any day, however you want to break it up.',
      'This one is scored by the **week**, not the day. There’s no daily quota to hit and no “you missed a day” — you owe the week 300 reps and it’s on you how they get there. Weeks run Sunday to Saturday.',
      'August opens on a Saturday, so Week 1 is a single day worth 50, and the last stretch (Aug 30–31) is worth 100. Every short week is priced at the same 50/day as a full one.',
      'The home screen is rebuilt for it: one bar you fill across the week with 1/4, 1/2 and 3/4 marked on it, plus what’s left and roughly how many a day it’ll take to finish.',
      'Logging is now **additive** — pick your variation, tap +20, done. Both your variation and your weight stick between sessions, so most of the time it’s a single tap. There’s an Undo if you fat-finger it.',
      'New: **post your weight**. Tap the 🏋 button, say whether it’s one dumbbell or two, and it shows up as a short badge next to your name on the leaderboard — `2×25`, `1×35`, `65 lb`, or `BW` for chin-ups. Totally optional.',
      'A “this week’s mix” panel shows what your reps were actually made of — how much came from dumbbells vs hammers vs chin-ups.',
      'The leaderboard now tracks the week: your row shows `180/300` until you hit it, then ✅. The “call out a PAX” list switches to whoever is short of the week rather than whoever hasn’t logged today.',
      'Your 🔥 daily streak still counts, and still only asks that you log *something* — two reps on a rest day keeps it alive. A new 💪 badge next to it tracks weeks hit.',
      'Come up short on a week? It’s not gone. **Catch Up** lets you top up any closed week for full trophy credit, same as making up a day.',
      'Trophies this month are **Bicep-themed**: 🥉💪 Bronze Bicep, 🥈💪 Silver Bicep, 🥇💪 Gold Bicep — scored on total reps banked across August (1,350 for Gold).',
      'Silver now lands at **75%** of a challenge instead of 80%, on every challenge. Nobody’s existing trophy goes down.',
      'Six new badges for August: **The Bedrock Bicep** (hit every week), **Century Curl** (100 in one day), **Four-Way Flex** (all four variations in one week), **Chin Music** (100 chin-ups), **Ahead of the Curl** (finish a week with 2 days to spare), and **Sleeve Buster** (2,000 reps).',
      'The weekly bonus is back and stays a mystery until its week opens — first one unlocks Sunday, Aug 2. Keep an eye out.',
      'The app is now F3 Norcal Monthly Challenge — F3 Sactown is joining us, kicking off with Sactown Century: 100 merkins a day, all month. Welcome, Sactown. 🤝',
      'Everything you see is your own region: your crew on the leaderboard, your feed, your challenge, your reminders. Bedrock and Sactown run separate months and separate boards — nothing of yours moved or changed.',
      'New PAX pick their region when they sign up, or land straight in it from their region’s invite link.',
      'Two PAX in different regions can now share an F3 name without the app arguing about it.',
      'The app has a real address: f3challenges.com \u2014 that\u2019s the one to use from here on. Already got it on your home screen? Leave it exactly where it is: your existing icon keeps working, notifications and all. Nothing to reinstall, nothing to move.',
      'Reminders now make sense on day one of a brand-new region \u2014 if you\u2019re the first PAX in, the app stops congratulating a crew that isn\u2019t there yet.',
    ],
  },
  {
    date: '2026-07-28',
    changes: [
      'Monthly trophies now come in tiers. Finish half the challenge and you take home 🥉 Bronze, 80% earns 🥈 Silver, and every required day is 🥇 Gold. Log at least one day and you’re on the board with a 🎖️ Participant trophy.',
      'A new card on the home screen, right under Quick Tap, tells you where your trophy stands and exactly what the next one costs — “🥉 Bronze earned — Silver next. 6 more days upgrades you.”',
      'You claim each tier the moment you cross it, not at the end of the month — full-screen moment, and the crew sees it in the feed.',
      'Trophies only ever go up, and a challenge is never closed. Make up days from a challenge that ended months ago and that month’s trophy climbs with you, all the way to Gold.',
      'Your profile now shows this month’s trophy under the days count, with the Bronze/Silver/Gold marks laid out so you can see the gap you’re closing.',
      'Trophies you already earned are untouched — every past finish reads as Gold, and every past participation trophy reads as Silver.',
      'Dropped the sarcastic feed posts that kicked in past the halfway mark of a challenge — no more “somebody check on @PAX, that’s not normal behavior” when you log a day. Posts for a finished day now read the same all month.',
      'Knock out more than one day in a single day — today plus a makeup or three — and your next reminder actually says so: “Triple Threat: 3 full days in one day.”',
      'Been away for a few days? Your reminders now know it. Miss 3+ days and you’ll get a come-back-in nudge instead of the usual one, and the day you return the app says welcome back instead of pretending nothing happened.',
      'Competitive nudges (if you have them on) now call a photo finish: when the PAX ahead of or behind you is within striking distance, you get “8 reps. That’s all that separates you” instead of a generic standings update.',
      'The feed knows about stacks and comebacks too. Knock out three days in one day and the posts build on each other instead of repeating — “@PAX has now put away 3 full days in one day.” Come back after time off and the post says so.',
      'New leaderboard posts: when your reps actually move you past someone on the board, the feed calls it — “@PAX just passed @OtherPAX on the board — by a single rep.” Once per PAX per day, so nobody can spam it.',
      'A pile of new reminder and feed-post variations, so the same message stops showing up twice in a week — including a bunch of dumb movie and song references. Hit the halfway mark and the feed is contractually obligated to tell you you’re livin’ on a prayer.',
      'Fixed reminders that started mid-sentence in lowercase — “the dead hang, standard merkins, and LBCs on Day 2 — don’t let it pile up” now reads like a sentence.',
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
