# Tech debt

Known compromises, why they exist, and what makes each one urgent. Nothing here is broken today — it's the list of things that will bite, roughly in the order they're likely to.

Roadmap and phase planning live in `MULTI_REGION.md`. This file is only for debt.

---

## 1. Mentions render by name, not by user id

**Where:** `src/components/feed/FeedPost.tsx` (`buildContent`), `extractMentionNames` in `src/lib/utils.ts`, mention write path in `NewPostModal.tsx` / `EditPostModal.tsx`.

A post stores a mention **twice**: as resolved ids in `FeedPost.mentions`, and as raw text in `content` (`"great work @Splice"`). Two consumers then disagree about which is authoritative:

- **Push notifications** (`onFeedPostCreated`) read `mentions` — ids, correct, survive a rename.
- **Feed rendering** ignores `mentions` entirely. It builds a regex of every current `displayName` and matches against the text, so the profile link is resolved *at render time, from whoever holds that name now*.

The result is that display names behave like primary keys even though a real id exists and is already stored on the document.

**What it costs today:** F3 names can never be reused. Renaming appends to `User.formerNames`, archived PAX keep their name reserved, and `isNameTaken()` (`src/lib/roster.ts`) checks current names, archived names and former names. That machinery exists purely to prevent a name collision, because a collision would retroactively re-point every historical `@Splice` in ~1,000 posts at a different person — silently, and invisibly to the audit log.

There's a second, smaller symptom: the regex sorts names longest-first so a PAX called "Jo" doesn't match inside "@Joe". That works, but it's a fragile fix for a problem id-based rendering wouldn't have.

**The fix:** render mentions from ids instead of text. Either resolve against the `mentions` array that's already on the post, or store a marker in the content (`@[Splice](mni3cd8...)`) that displays the name and links the id. Then renames just work — old posts render the *new* name — and `formerNames`, the archived-name reservation and the length-sorted regex all become unnecessary.

**Cost to fix:** a migration over existing feed posts, plus touching the most-used screen in the app.

**When it becomes urgent:** as soon as renames get used regularly, or the first time someone wants to reuse a departed PAX's name. Today it's contained because renaming only became possible with the admin panel.

---

## 2. PAX are unauthenticated

**Where:** everywhere. `firestore.rules` is `allow read, write: if true` for almost everything; identity is a `userId` in `localStorage`.

A deliberate, documented trade for a ~25-person group who know each other. Two consequences worth naming plainly:

- Any PAX can tap another PAX's name and log or post as them. No hacking required — that's the sign-in screen working as designed.
- **Archiving is not a lock.** It removes someone from rosters, counts, pickers and reminders, and stops the app on their device. It cannot stop someone writing to Firestore directly with the public config, and `users` still allows delete, so an archived PAX could drop and recreate their own document. They can also just re-onboard under a different name.

**The fix:** Phase 3 — authenticate PAX (Firebase Anonymous Auth is the low-friction option: silent, no SMS, no user-visible change) and bind each user document to the device that claimed it, then close the rules.

**When it becomes urgent:** when the group grows past people who know each other, when a region admin needs to be genuinely restricted rather than trusted, or the first time someone abuses it.

---

## 3. Challenges are static TypeScript

**Where:** `shared/src/challenges.ts`.

Adding a challenge means editing a file and deploying. Kyle is therefore the bottleneck for every region's every month.

Fine at two regions. It is the hard ceiling on NorCal-wide adoption — five Qs each wanting their own August challenge is not a thing this design supports.

**The fix:** a challenge builder writing to Firestore, with the static file as a fallback/seed.

**When it becomes urgent:** the third region.

---

## 4. Leaderboard fires one query per PAX

**Where:** `src/app/leaderboard/page.tsx:232` — `getUserChallengeLogs(user.id, challenge.id)` inside a `map` over the roster. Also `getUsersWithChallengeLogs` (`src/lib/firestore.ts:195`), which does the same shape.

25 PAX = 25 round trips on every leaderboard load. Reads are cheap and the roster is small, so this is currently a latency annoyance rather than a cost problem.

**The fix:** one `where('challengeId', '==', id)` query and group in memory — the Cloud Function already does exactly this.

**When it becomes urgent:** a region of 60+, or leaderboard load times becoming noticeable.

---

## 5. `/api/admin/users` scans all of `dailyLogs`

**Where:** `src/app/api/admin/users/route.ts`.

Reads every user and **every daily log ever written** on each call, to compute `logCount` and `lastActiveDate`. `/admin/admins` calls it too, just to populate a dropdown.

`dailyLogs` grows ~750/month and is never pruned. At ~800 logs today that's ~825 reads per load — irrelevant against a 50k/day free quota. By mid-2027 it's ~10k reads per load, and five panel loads would consume the daily free quota.

**The fix:** scope the scan to the current challenge (`where('challengeId', '==', …)`, already indexed), or split the activity stats into their own call so the dropdown doesn't pay for them.

**When it becomes urgent:** roughly a year out, or sooner if the panel gets used often.

---

## 6. `/api/admin/feed` is N+1

**Where:** `src/app/api/admin/feed/route.ts`.

One comments subcollection query per post, 50 posts per page, plus a full `users` read. ~50–150 reads and a second or two of wall clock.

Acceptable at `PAGE_SIZE = 50`. **Don't raise that number** without restructuring — a collection-group query on `comments` filtered by parent post would be the fix.

---

## 7. `getTodayPT()` is hardcoded Pacific

**Where:** `shared/src/challenges.ts` and every date helper.

`Region.timezone` exists in the data model and nothing reads it. Every region is currently PT, so this is invisible.

**When it becomes urgent:** the first non-Pacific region. Day boundaries, streaks, notification windows and week slicing all key off this, so it's a wider change than it looks.

---

## 8. Region move isn't supported

**Where:** deliberately absent from the admin panel.

Name resolution is scoped to one region's roster, so moving a PAX with history leaves their old posts, mentions, comments and reactions unresolvable in the origin region. Wrong-invite-link fixes are a hand-run script for now.

**The fix:** a shared id-keyed user resolver that hydrates any referenced id on screen. Largely subsumed by item 1 — fixing mention rendering removes most of the reason this is hard.

---

## 9. Two origins serve the app

**Where:** Vercel project aliases.

Existing Bedrock PAX are installed on `f3-bedrock-monthly-challenge.vercel.app`; everyone new gets `f3challenges.com`. Both work identically and hit the same deployment and Firebase project.

**The constraint:** the legacy alias must stay attached. Detaching it, or turning it into a redirect, breaks those installs — a cross-origin 301 kicks an installed PWA out of standalone mode.

**The fix:** nothing, unless a reason appears. Documented so nobody "tidies it up".

---

## 10. Streaks contradict rest-day guidance on weekly-cumulative challenges

**Where:** streak calculation vs. `shared/src/challenges.ts` copy for the Bicep challenge.

The 🔥 streak counts consecutive days with ≥1 rep, while the challenge's own guidance says to take a rest day each week, and push copy leans on "your N-day streak". A PAX following the advice loses the streak.

**The fix:** either make the streak week-aware on `weekly-cumulative` challenges, or stop surfacing daily streaks there.

**Status:** known and consciously deferred.

---

## 11. Audit and notification logs have no retention

**Where:** `adminAudit`, `notificationLog`.

Both are append-only and never pruned. Small and cheap, but unbounded. A scheduled cleanup dropping entries older than a year would be a few lines in the existing `onSchedule` function.

---

## 12. Local rules tests need JDK 21

**Where:** `pnpm test:rules`.

The Firestore emulator needs JDK 21+; the default JDK on this machine is 18, so locally the suite needs:

```bash
JAVA_HOME=/opt/homebrew/opt/openjdk@21 pnpm test:rules
```

CI pins Java 21, so this is a local-dev papercut only. The override isn't baked into the npm script because it's macOS/Homebrew-specific.

---

## 13. `ADMIN_BOOTSTRAP_EMAILS` should be cleared once used

**Where:** Vercel and `.env.local`.

Bootstrap is one-time and guarded by a durable marker, so leaving the variable set is safe by design. Clearing it after the first superadmin exists costs nothing and removes a path that only ever needs to work once.
