# Multi-Region

> Known compromises and their expiry dates live in [`TECH_DEBT.md`](./TECH_DEBT.md).

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

`src/lib/firestore.ts` holds an ambient `activeRegionId`, kept in sync by `RegionProvider`, and every create helper stamps it via `withRegion()`. This is deliberate: threading a `regionId` parameter through ~15 call sites means a missed one silently writes a region-less doc that never appears in its own feed. An explicit `regionId` already on the document always wins — that's how any server-side caller stays correct, since the ambient value is browser-only.

### Previewing another region

A superadmin can load any region's app as its PAX see it (`viewingAs` in `RegionContext`, switched from Settings, sessionStorage so it ends with the tab). Alongside `activeRegionId`, the same module holds a **write scope** that says what may be written into the region on screen:

| Scope | When | What's allowed |
|---|---|---|
| `own` | not previewing | everything |
| `social` | previewing, confirmed superadmin | feed posts, comments, reactions |
| `readonly` | previewing, anyone else — including before the admin check returns | nothing |

The split is about what a write *means*, not about trust. A daily log belongs to a challenge and a crew: written from a preview it would be stamped with the region being viewed and counted for people the author doesn't train with. A feed post has no such second meaning — it's attributed to whoever wrote it, and an admin answering a question in another region's feed is the point of the feature.

Two things follow from it:

- **`authorName` on `FeedPost` / `FeedComment`.** The feed resolves authors against the region roster, and a visiting admin is by definition not in it, so new posts and comments carry their author's F3 name as a fallback. The roster still wins wherever it has an answer, so a rename stays live on a PAX's own posts.
- **`createFeedPostOnce` stays on the strict guard.** Its callers are automated posts about the author's own progress — those belong in their own region's feed, and are unreachable while previewing anyway since the log that triggers them is blocked first.

`AdminModeProvider` is what opens the `social` scope, after `/api/admin/status` confirms the role. Preview restores itself from sessionStorage before anyone has been checked, so it starts closed and is opened afterwards, never the reverse. None of this is a security boundary — Firestore rules are open (Phase 3 below) — it's there to stop an admin accidentally logging into someone else's region.

### The ADMIN tag

`/api/admin/roles` returns `paxUserId → role` for every admin who has linked a PAX account; `useAdminRoles()` fetches it once per page load and shares the result. Feed posts, comments and profiles render `<AdminBadge>` from it. Unauthenticated for the same reason `/api/admin/status` is, and it returns strictly less: no email, no uid, no name. Live admins only — a pending designation is a name on a list, and revoking an admin drops the tag everywhere on next load, because nothing about it is stored on the posts.

### Region resolution

`src/contexts/RegionContext.tsx`, in priority order:
1. `?region=` on the URL (the invite link — and it sticks)
2. `localStorage` (`f3_region_id`)
3. the cached user's `regionId`
4. Bedrock

Resolved in an effect, not a render-phase initializer — localStorage doesn't exist during SSR, and resolving inline would prerender Bedrock and hydrate Sactown. Consumers wait on `ready`. The user doc is the final authority: `UserContext` adopts `user.regionId` if it disagrees.

### Invite links

`https://f3challenges.com/sactown` — one per region, generated from `REGIONS` by `src/app/[region]/page.tsx`.

That route is a redirect to `https://f3challenges.com/onboarding?region=sactown`, which is still the real mechanism and still works if you have it written down somewhere. Either form preselects the region and skips the region step; without it, the picker shows.

The segment is prerendered with `dynamicParams = false`, so unknown top-level paths 404 normally rather than bouncing through onboarding. Static routes (`/feed`, `/settings`, …) take precedence over it, so a region id must not collide with one.

## Adding a region

1. Append to `REGIONS` in `shared/src/regions.ts`.
2. Add a challenge with `regionIds: ['<new-id>']` in `shared/src/challenges.ts`.
3. Send the Q the invite link — `f3challenges.com/<new-id>`, which exists as soon as step 1 ships.

No other changes. Empty states (no feed posts, no past challenges, no badges, no leaderboard history) are already handled.

## Gotchas

- **Achievements must be region-filtered.** `shared/src/achievements.ts` iterates `CHALLENGES` in several places; `AchievementContext.regionId` and `achievementsForRegion()` keep another region's signature badges out of the trophy case. `buildAchievementContext` takes it from the *user*, not the viewer, so a profile reads the same whoever opens it.
- **Cloud Functions loop regions.** `notifyRegion()` runs one region's pass; a throw is caught per region so one region's failure can't silence the other's reminders.
- **New Firestore query = new index.** The feed's `regionId + deleted + createdAt` composite is in `firestore.indexes.json`.
- **`getTodayPT()` is still hardcoded Pacific.** `Region.timezone` exists but nothing reads it. Fine while every region is PT; the first non-PT region needs the date helpers changed.
- **Never seed component state from a region-derived list in a lazy initializer.** The region resolves a tick after mount, so the initializer sees Bedrock's data. `PastChallengesSettings` and `PastChallengesStep` re-seed via an effect keyed on the challenge-id list. Prefer deriving, or wait on `ready`.
- **Logout goes through `clearRegion()`, not just `clearStoredRegionId()`.** Clearing only localStorage leaves the provider at `chosen: true`, so re-onboarding on a shared device silently inherits the previous PAX's region.
- **Server routes resolve the region from the user doc, never the request body.** The ambient `activeRegionId` is browser-only and would stamp Bedrock on everything; taking it from the body would let a client write into another region.

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

### Phase 4 — Custom domain ✅ (shipped 2026-07-31)

Live at **f3challenges.com** (Vercel Hobby — custom domains are free there; the cron limit that normally forces an upgrade is already sidestepped by running notifications on Firebase `onSchedule`).

- Domain added to the Vercel project, connected to Production. Apex only — the "redirect apex to www" default was unchecked, so the app serves bare `f3challenges.com`.
- Squarespace DNS: deleted the "Squarespace Defaults" preset (four parking A records on `@`, a `www` CNAME, and an HTTPS record whose `ipv4hint` pointed at Squarespace IPs — all of which fight Vercel). Added `A / @ / 216.198.79.1`. Domain Connect and Email Security (SPF/DKIM/DMARC) left intact.
- The legacy `*.vercel.app` origin stays connected to Production as a second alias.

**Nobody reinstalls.** An installed PWA is bound to its origin, but the old origin serves the *same deployment* against the *same* Firebase project — so an existing install is a fully working app, not a stale one. Push keeps landing because `fcmOptions.link` is a relative path (`/feed`) that resolves against whichever origin registered the service worker; `APP_URL` is only used for a server-to-server recap fetch and works from either.

A migration takeover was built and then removed before it did any harm. It's the wrong trade: it blocked a working app, and its FCM cleanup would have **deleted live push tokens** from installs that had no problem. If a reason to retire the old origin ever appears, the thing to preserve is that the old origin must keep *serving* — a cross-origin 301 kicks an installed PWA out of standalone mode.

What survives is `claimUrl()` / `consumeClaimParam()` in `src/lib/migration.ts`: `?claim=<userId>` restores a session without re-picking a name off the roster. Useful for a new phone, or for anyone who does choose to move across. `user.migratedAt` records who has.

**Known wart:** two cohorts now exist — existing Bedrock PAX on `*.vercel.app`, everyone new on `f3challenges.com`. Both work identically. The old alias must stay attached to the Vercel project; detaching it would break those installs.

### Backlog
Inter-regional leaderboard toggle and region-vs-region card · admin challenge builder (challenges are static files today, so Kyle is the bottleneck for every region) · self-serve region creation · per-region timezone · leaderboard read-scaling (`getUsersWithChallengeLogs` fires one query per user, `src/lib/firestore.ts`)
