# Multi-Region

Living tracker for taking the app from one region (F3 Bedrock) to many. Phase 1 shipped for Aug 1, 2026, when F3 Sactown joined with their 100-merkins-a-day challenge.

## How regions work

**Regions are static data**, like challenges: `shared/src/regions.ts`. Adding a region is appending one object to `REGIONS` and giving it a challenge. There is no `regions` Firestore collection — Cloud Functions resolve regions from the same bundled `@f3-bedrock/shared` import they already use for challenges.

**Challenges belong to regions** via `ChallengeTemplate.regionIds?: string[]`. Absent means Bedrock-only, which is why the six pre-multi-region challenges needed no edits. Listing more than one region shares a challenge across them — they still get separate leaderboards and feeds.

```ts
getChallengeForDate(date, regionId)   // region is required: two regions can
getCurrentChallenge(regionId)         // run different challenges on the same date
challengesForRegion(regionId)         // use instead of scanning CHALLENGES
```

In components, use the hooks in `src/hooks/useChallenge.ts` (`useCurrentChallenge`, `usePastChallenges`) rather than passing `regionId` around by hand.

### What is actually scoped, and what isn't

`challengeId` already partitions most collections, because regions run different challenges. Only two things needed a region dimension to function:

| Collection | Scoped by | Why |
|---|---|---|
| `users` | `regionId` (queried) | The roster drives the name picker, @mention autocomplete, callout modal, leaderboard rows, and every group-completion denominator |
| `feed` | `regionId` (queried) | The only collection with no challenge filter |
| `dailyLogs`, `participation`, `bonusLogs` | `challengeId` | `regionId` is written but **not** queried — denormalized so a shared inter-regional challenge won't need a second migration |

**The roster is the chokepoint.** `subscribeToUsers(regionId, …)` is scoped once in `src/contexts/UserContext.tsx`; every downstream consumer of `allUsers` (~25 call sites) becomes region-correct for free.

### Writes

`src/lib/firestore.ts` holds an ambient `activeRegionId`, kept in sync by `RegionProvider`, and every create helper stamps it via `withRegion()`. This is deliberate: threading a `regionId` parameter through ~15 call sites means a missed one silently writes a region-less doc that never appears in its own feed. An explicit `regionId` already on the document always wins — that's how server-side callers (`/api/log`) stay correct, since the ambient value is browser-only.

### Region resolution

`src/contexts/RegionContext.tsx`, in priority order:
1. `?region=` on the URL (the invite link — and it sticks)
2. `localStorage` (`f3_region_id`)
3. the cached user's `regionId`
4. Bedrock

Resolved in an effect, not a render-phase initializer — localStorage doesn't exist during SSR, and resolving inline would prerender Bedrock and hydrate Sactown. Consumers wait on `ready`. The user doc is the final authority: `UserContext` adopts `user.regionId` if it disagrees.

### Invite links

`https://f3challenges.com/onboarding?region=sactown`

Preselects the region and skips the region step. Without the param, the picker shows.

## Adding a region

1. Append to `REGIONS` in `shared/src/regions.ts`.
2. Add a challenge with `regionIds: ['<new-id>']` in `shared/src/challenges.ts`.
3. Send the Q the invite link.

No other changes. Empty states (no feed posts, no past challenges, no badges, no leaderboard history) are already handled.

## Gotchas

- **Achievements must be region-filtered.** `shared/src/achievements.ts` iterates `CHALLENGES` in several places; `AchievementContext.regionId` and `achievementsForRegion()` keep another region's signature badges out of the trophy case. `buildAchievementContext` takes it from the *user*, not the viewer, so a profile reads the same whoever opens it.
- **Cloud Functions loop regions.** `notifyRegion()` runs one region's pass; a throw is caught per region so one region's failure can't silence the other's reminders.
- **New Firestore query = new index.** The feed's `regionId + deleted + createdAt` composite is in `firestore.indexes.json`.
- **`getTodayPT()` is still hardcoded Pacific.** `Region.timezone` exists but nothing reads it. Fine while every region is PT; the first non-PT region needs the date helpers changed.
- **Never seed component state from a region-derived list in a lazy initializer.** The region resolves a tick after mount, so the initializer sees Bedrock's data. `PastChallengesSettings` and `PastChallengesStep` re-seed via an effect keyed on the challenge-id list. Prefer deriving, or wait on `ready`.
- **Logout goes through `clearRegion()`, not just `clearStoredRegionId()`.** Clearing only localStorage leaves the provider at `chosen: true`, so re-onboarding on a shared device silently inherits the previous PAX's region.
- **Server routes resolve the region from the user doc, never the request body.** The ambient `activeRegionId` is browser-only and would stamp Bedrock on everything; taking it from the body would let a client write into another region. See `/api/log`.

## Migration

`scripts/backfill-regions.mjs` stamps `regionId: 'bedrock'` on every pre-region document. **Must run before the multi-region build deploys** — region-scoped queries use equality filters, so a doc with no `regionId` matches nothing and vanishes from the app.

```bash
node scripts/backfill-regions.mjs --dry-run   # report only
node scripts/backfill-regions.mjs             # apply (idempotent)
```

Safe to run against production *before* deploying, while the old single-region build is still live — it only adds a field the old code ignores. As of 2026-07-30 the dry run reported 1,887 documents needing it (24 users, 1,072 feed, 762 dailyLogs, 13 participation, 16 bonusLogs).

Cloud Functions are built from source by `.github/workflows/firebase-deploy.yml` (`pnpm build` in `functions/`) on push to `main`; `functions/lib/` is a local artifact and is not tracked, so a stale local build can't ship.

### Deploy order matters

Vercel (app) and GitHub Actions (Firestore indexes) both fire on push to `main` — and **they race**. A composite index takes minutes to build; if the app goes live first, every query needing that index throws `failed-precondition` and the surface renders empty. This was caught live: the feed came back blank with

```
FirebaseError: [code=failed-precondition]: The query requires an index.
```

Correct sequence:

1. **Backfill** — `node scripts/backfill-regions.mjs` (done 2026-07-30)
2. **Deploy the index and wait for it to finish building** — `npx firebase-tools deploy --only firestore:indexes`, then confirm "Enabled" in the Firebase console
3. **Then** merge to `main` so Vercel ships the app

Note which queries need this: the feed (`regionId` + `deleted` + `createdAt DESC`) does. The `users` roster query does **not** — it's a single equality filter, which is why the leaderboard and name picker kept working while the feed was broken. Same for `getLatestShoutoutsByUser`, which stays equality-only by design.

## Roadmap

### Phase 1 — Aug 1 MVP ✅
Region model, region-scoped roster + feed, region-aware challenges and achievements, onboarding region step + invite links, region-aware Cloud Functions, rename to F3 Norcal, backfill.

### Phase 2 — Admin
No admin panel exists; admin work is manual for now.

- Roles: superadmin (cross-region), region admin (scoped), member
- Users: suspend/unsuspend, soft-delete, rename, **merge duplicates** (no auth means a PAX on a new phone creates a second account and splits their streak), move between regions, promote admins
- Moderation: soft-delete any post/comment, pin a post, post as the region
- Data fixes: edit/backfill another PAX's daily log, manually award or revoke a badge, opt someone in/out
- Ops: broadcast push, notification diagnostics (who has tokens, who isn't receiving), region settings

### Phase 3 — Security
`firestore.rules` is currently `allow read, write: if true` everywhere. Trust-based is fine for one region of 20 who know each other; it is not fine for cross-region admin actions. Needs Firebase Anonymous Auth + custom claims for role, and rules gating `role` / `regionId` / `suspended` writes to admins. **This is a prerequisite for Phase 2, not a follow-up** — an unauthenticated destructive admin endpoint is worse than no admin panel.

### Phase 4 — Custom domain + PWA migration ✅ (built, not yet shipped)

Live at **f3challenges.com** (Vercel Hobby — custom domains are free there; the cron limit that normally forces an upgrade is already sidestepped by running notifications on Firebase `onSchedule`).

**Infrastructure (done 2026-07-30):**
- Domain added to the Vercel project, connected to Production. Apex only — the "redirect apex to www" default was unchecked, so the app serves bare `f3challenges.com`.
- Squarespace DNS: deleted the "Squarespace Defaults" preset (four parking A records on `@`, a `www` CNAME, and an HTTPS record whose `ipv4hint` pointed at Squarespace IPs — all of which fight Vercel). Added `A / @ / 216.198.79.1`. Domain Connect and Email Security (SPF/DKIM/DMARC) left intact.
- The legacy `*.vercel.app` origin stays connected to Production as a second alias. **Never make it a redirect** — a cross-origin 301 kicks an installed PWA out of standalone mode.

**Why any of this is needed:** an installed PWA is bound to its origin. localStorage doesn't carry over (every PAX lands back at onboarding), FCM tokens are tied to the service worker registration at the old origin (so the *old* install keeps receiving push), and iOS additionally needs the icon deleted, re-added, and notification permission re-granted.

**The flow** (`src/lib/migration.ts`, `src/components/providers/MigrationGate.tsx`):
1. `MigrationGate` takes over the screen on the legacy origin only — `LEGACY_HOSTS` is an exact-host list, so localhost and previews never see it. A session-scoped "Not right now" escape hatch stops anyone being stranded.
2. The CTA is a one-time claim link, `https://f3challenges.com/?claim=<userId>`.
3. `UserContext` consumes `?claim=` before anything else touches the session (child effects run before parent ones), lands the PAX signed in past onboarding in their own region, and stamps `user.migratedAt`. It ignores the local cache on a claim — that cache belongs to whoever used the new origin last.
4. Back on the legacy origin, `migratedAt` triggers `retireLegacyPushRegistration()`: remove the token from Firestore **first**, then `deleteToken()` (reverse that order and the token is unrecoverable but still live in the array), then unregister the service worker. This is what actually stops double-push.

`APP_URL` in `functions/src/index.ts` now defaults to the new origin — otherwise every push deep-links PAX back to the origin they just left, where the gate hands them straight back again. No `APP_URL` env override exists anywhere, so the code default governs.

**Reinstall instructions live on the NEW origin** (`src/components/providers/ReinstallPrompt.tsx`), not the old one. This is deliberate and was a bug first time around: the old origin can only report whether *that session* is standalone, and the announcement link gets opened from Slack — i.e. a browser tab — so it reads "not installed" even for PAX who do have the old icon. It's also the wrong moment: they read the steps, tap through, and the steps are gone. On the new origin `isStandalone()` answers the question that actually matters (is this device set up here yet), and the steps are in front of them when they can act. The old origin just carries a one-line heads-up.

The steps are migration-specific, not the generic onboarding install guide: add to home screen, **delete the old icon**, and on iOS re-allow notifications (a new origin is a new app, so permission resets). Driven by a `f3_needs_reinstall` localStorage flag set on claim, cleared once standalone is detected or the PAX dismisses.

**Remaining:** ship it (merge to `main`), then tell the PAX. Nothing prompts anyone until the build with `MigrationGate` is deployed — the new domain currently serves the same app quietly.

### Backlog
Inter-regional leaderboard toggle and region-vs-region card · admin challenge builder (challenges are static files today, so Kyle is the bottleneck for every region) · self-serve region creation · per-region timezone · leaderboard read-scaling (`getUsersWithChallengeLogs` fires one query per user, `src/lib/firestore.ts`)
