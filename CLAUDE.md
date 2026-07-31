@AGENTS.md

# F3 Bedrock Monthly Challenge

Monthly fitness-challenge PWA for F3 regions (~20 PAX each). Trust-based user selection — no auth. Next.js 16 App Router + TypeScript + Tailwind v4 (CSS config, no `tailwind.config.ts`) on Vercel; Firestore + Cloud Functions v2 + FCM on Firebase Blaze. pnpm workspace: root app + `shared/`; `functions/` is a separate root.

Don't restate the current challenge here — it goes stale. `getCurrentChallenge(regionId)` is the answer.

## Commands

```bash
pnpm install     # required first in fresh/CI checkouts — without it tsc and lint
                 # emit hundreds of bogus "Cannot find module 'react'" errors
pnpm test        # vitest
pnpm lint        # eslint (lint-staged runs it on commit, --max-warnings=0)
npx tsc --noEmit
```

Never commit with `--no-verify`; the husky hooks must run.

## Non-negotiables

**Changelog.** Every PAX-visible change adds a bullet to `CHANGELOG` in `src/lib/changelog.ts` (newest first; append to today's `YYYY-MM-DD` entry if it exists). Written *for the PAX* in plain English — what they'll notice, not how it was built. Purely internal work (refactors, CI, types) gets nothing. Rendered by `/changelog` and `UpdateBanner`; no other wiring.

**`stripUndefined()`** (`src/lib/utils.ts`) before every `setDoc`/`updateDoc`. Optional fields arrive as `undefined` and Firestore throws "Unsupported field value: undefined".

**Firebase Admin** only via `adminDb` / `adminMessaging` from `src/lib/firebase-admin.ts` — a lazy `Proxy` that defers init past module load. Importing `firebase-admin` directly in server code crashes the build.

**One notification writer.** Shoutout/mention pushes come from the `onFeedPostCreated` Cloud Function. Never also write them client-side (double-notification bug).

## Regions

`shared/src/regions.ts` — static data like challenges, not a Firestore collection. Adding a region = one object in `REGIONS` + a challenge listing its id.

- Challenges belong to regions via `ChallengeTemplate.regionIds`; absent means Bedrock-only (`DEFAULT_REGION_ID`).
- `getChallengeForDate`/`getCurrentChallenge` **require** a `regionId` — two regions can run different challenges on the same dates. Use `challengesForRegion()` instead of scanning `CHALLENGES`; in components use the hooks in `src/hooks/useChallenge.ts`.
- Only `users` and `feed` are *queried* by `regionId`. `dailyLogs`/`participation`/`bonusLogs` partition by `challengeId` and merely stamp `regionId`.
- Writes stamp the region from an ambient `activeRegionId` in `src/lib/firestore.ts` (`withRegion()`), kept in sync by `RegionProvider`. An explicit `regionId` on the doc wins — that's how server routes stay correct, since the ambient value is browser-only.

Full design + migration notes: `docs/MULTI_REGION.md`.

## Challenges

Single source of truth: `shared/src/challenges.ts`. Adding a challenge = appending one object to `CHALLENGES`; nothing else changes. `src/lib/challenges.ts` and `src/types/index.ts` re-export from `@f3-bedrock/shared`; `functions/src/index.ts` imports it directly (esbuild `--alias` at build time).

| `type` | Scoring | Target shape |
|---|---|---|
| `escalating` (default) | completed days | day N = N × `dailyMultiplier`, split across exercises |
| `weekly-tiers` | completed days | fixed per-exercise daily amounts per `weeklyTiers` range |
| `weekly-cumulative` | **reps banked** | one pooled rep target per week (`weeks[]`), no daily quota |

`weekly-cumulative` breaks the daily model — the gotchas:
- `getDailyTarget()` returns `isOpenEnded: true`, `totalReps: 0`. UI showing daily progress **must** branch on that flag or it renders "0 reps".
- `DailyLog.completionFraction` means "did you train today" (1/0), not share of a target. Week completion comes from `getWeekProgress()` and is never stored on a day.
- `weeks[]` is explicit so a month can open/close mid-week with a prorated target; `weekStartsOn` (0=Sun) keeps app, leaderboard, and Functions slicing identically.
- Pushes route to `buildWeeklyNotification()`; feed posts fire on week completion (`weekCompleteFeedPost`), since every logged day would otherwise "complete".

**Trophies are unit-agnostic.** `shared/src/trophies.ts` scores in `getTrophyUnit(challenge)` — days normally, reps on weekly-cumulative. Rungs 50/75/100%. `trophyStyle` re-skins emoji and labels per challenge; call `getTrophyTier(tier, challenge)` — passing the challenge is what applies the theme.

**Badges are data.** `ChallengeBadgeDef.criteria` covers `complete-challenge`, `complete-days`, `challenge-reps`, `exercise-reps`, `single-day-reps`, `weeks-completed`, `week-variety`, `week-early`. New criteria = one case in `criteriaRule()` (`achievements.ts`), free for every later challenge.

**`DailyLog.load`** is one optional weight per log, not per exercise — deliberately coarse, never affects scoring. `formatLoad()` renders the badge (`2×25`, `65 lb`, `BW`).

## Notifications

- Scheduled by Firebase `onSchedule("*/10 * * * *")`, not Vercel Cron (Hobby = 1/day). `vercel.json` is intentionally `{}`.
- Copy is algorithmic — template arrays varied by `dayNumber`, no LLM. (`src/lib/openai.ts` exists but only serves the recap route.)
- `notificationLog` in Firestore dedupes; rules block client writes.

## Firestore rules

Trust-based, allow all reads/writes, except: `feed` blocks hard deletes (soft delete via `deleted: true`), `notificationLog` blocks client writes.

## Deployment

- Prod: `https://f3challenges.com` (Vercel Hobby, apex, no `www`). Vercel auto-deploys on push to `main`; Functions + Firestore rules deploy via `.github/workflows/firebase-deploy.yml` on the same push — never deploy locally.
- Legacy origin `f3-bedrock-monthly-challenge.vercel.app` still *serves* the app as an alias, deliberately not a 301 — a cross-origin redirect kicks installed PWAs out of standalone mode.
- Env vars live in the Vercel dashboard (mirror of `.env.local`). Firebase project: `f3-bedrock-monthly-challenge`.
- `functions/` is excluded from `pnpm-workspace.yaml` (own lockfile + empty workspace file so Firebase Cloud Build can install). `@f3-bedrock/shared` is *not* in `functions/package.json` and never installed on the server — esbuild aliases it; `functions/tsconfig.json` has a matching `paths` entry for local typecheck.

## Platform

- Ads and premium are Android-only; iOS has neither.
- Push on iOS requires PWA install via Safari (16.4+). `PWAInstallStep` is platform-aware; `PWAInstallGuide` is shared by onboarding and the notifications troubleshoot page.

## Debug logging

Captures logs from deployed builds and real devices through an ngrok tunnel to a local receiver.

```bash
node .claude-debug/server.js   # :3333 → .claude-debug/debug.log
curl -s http://localhost:4040/api/tunnels | python3 -c "import sys,json;print(json.load(sys.stdin)['tunnels'][0]['public_url'])"
```

The tunnel URL changes when ngrok restarts — update `NEXT_PUBLIC_DEBUG_URL` in `.env.local` *and* Vercel, then redeploy. Call sites POST `{label, src, data}` to that URL and swallow errors; `NEXT_PUBLIC_` means it works in client components and route handlers alike.

## Files worth knowing

| Path | Why |
|---|---|
| `shared/src/challenges.ts` | challenge data + helpers — single source of truth |
| `shared/src/regions.ts` | region data |
| `src/lib/firestore.ts` | every read/write helper, plus ambient region stamping |
| `src/lib/firebase-admin.ts` | lazy Admin SDK proxy |
| `src/contexts/UserContext.tsx` | loads cached user from localStorage on mount (no async flash), then refreshes from Firestore; `subscribeToUsers(regionId)` is the roster chokepoint |
| `src/contexts/RegionContext.tsx` | region resolution: `?region=` → localStorage → cached user |
| `functions/src/index.ts` | all Cloud Functions; defines its own minimal `DailyLog`/`User`/etc. interfaces not in shared |
