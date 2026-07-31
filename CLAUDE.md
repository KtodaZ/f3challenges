@AGENTS.md

# F3 Bedrock Monthly Challenge — Project Context

## What this app is
Monthly fitness challenge PWA for F3 Bedrock (~20 PAX). April 2026: "The Merking Gauntlet" — 5 merkin variations, 10 reps on day 1 adding 10/day up to 300 on day 30. Trust-based user selection (no auth). Deployed on Vercel + Firebase.

## Tech Stack
- **Next.js 16** App Router + TypeScript + **Tailwind v4** (CSS-based config — no tailwind.config.ts)
- **Firebase Firestore** real-time onSnapshot listeners
- **Firebase Cloud Messaging (FCM)** with VAPID key, service worker at `public/firebase-messaging-sw.js`
- **Firebase Blaze** + Cloud Functions v2 (`onDocumentCreated`, `onSchedule`)
- **Firebase Admin SDK** — lazy proxy init in `src/lib/firebase-admin.ts` (prevents build-time crashes)
- **Radix UI**: dialog, dropdown-menu, switch, tooltip, slot
- **Sonner** for toasts
- **TanStack Query v5** with `isNetworkBlockedError()` retry logic
- **pnpm** as package manager + **pnpm workspace** (`pnpm-workspace.yaml`) for `shared/`

## Session Setup

Remote/CI environments start without `node_modules`. Always run this before type-checking or linting:

```bash
pnpm install        # installs workspace deps (src/ + shared/)
```

`tsc --noEmit` and `pnpm lint` will report hundreds of spurious "Cannot find module 'react'" errors until deps are installed — those are not code bugs.

## Changelog — ALWAYS update it

**Every change that a PAX could notice MUST add a bullet to the changelog.** No exceptions — treat it as part of "done," like a passing typecheck.

- Single source of truth: `src/lib/changelog.ts` (the `CHANGELOG` array, newest entry first).
- Entries are **curated, plain-English notes written FOR the PAX** — never raw commit messages, conventional-commit prefixes, or internal jargon. Describe what the user will notice, not how it was built.
- Add a bullet to today's entry if one exists (match the `YYYY-MM-DD` date), otherwise prepend a new entry.
- Purely internal changes (refactors, CI, build fixes, type-only edits with no user-visible effect) do **not** get an entry — the changelog is user-facing, not a commit log.
- Surfaces that render it: the `/changelog` page (linked from Settings) and the "What's new" reveal inside `UpdateBanner` (the update modal). Both read from `src/lib/changelog.ts` — no other wiring needed.

## Critical Patterns

### stripUndefined — always use before Firestore writes
```typescript
// src/lib/utils.ts
export function stripUndefined<T extends object>(obj: T): T
```
Optional TypeScript fields (notes, modificationNote, targetUserId) become `undefined` and crash Firestore with "Unsupported field value: undefined". Apply `stripUndefined()` before every `setDoc`/`updateDoc`.

### Firebase Admin lazy proxy
`src/lib/firebase-admin.ts` uses a `Proxy` so the Admin SDK only initializes on first access, not at module load time. Never import from firebase-admin directly in server code — always use `adminDb` and `adminMessaging` from this file.

### functions/ imports
`functions/src/index.ts` imports challenge data and helpers from `@f3-bedrock/shared` (resolved at build time via esbuild `--alias`). It defines its own minimal interfaces for app-specific types (`DailyLog`, `ChallengeParticipation`, `User`, etc.) that aren't in shared.

### Session persistence
`src/contexts/UserContext.tsx` loads cached user from `localStorage` immediately on mount (no async flash), then refreshes from Firestore in the background. Cache managed via `src/lib/storage.ts`.

## Challenge Template System
**Single source of truth: `shared/src/challenges.ts`**

Adding a new challenge = append one object to `CHALLENGES` in that file. Nothing else needs changing.
```typescript
{
  id: 'may-2026',
  name: 'May Challenge',
  hashtag: '#MayChallenge',
  tagline: '...',
  month: 5, year: 2026,
  dailyMultiplier: 10,
  exercises: [{ id: 'exercise-id', name: 'Exercise Name', shortName: 'Short' }],
  startDate: '2026-05-01',
  endDate: '2026-05-31',
}
```

### Challenge types (`ChallengeTemplate.type`)
| Type | Scoring | Target shape |
|------|---------|--------------|
| `escalating` (default) | completed days | day N = N × `dailyMultiplier`, split across exercises |
| `weekly-tiers` | completed days | fixed per-exercise daily amounts per `weeklyTiers` range |
| `weekly-cumulative` | **reps banked** | one pooled rep target per week (`weeks[]`), no daily quota |

**`weekly-cumulative` (August 2026 — The Bedrock Bicep Challenge) is the one that breaks the daily model.**
- `getDailyTarget()` returns `isOpenEnded: true` with `totalReps: 0`. Any UI showing daily progress **must** branch on that flag — otherwise it renders "0 reps".
- `DailyLog.completionFraction` means "did you train today" (1 or 0), **not** share of a target. Week completion is derived via `getWeekProgress()`; it is never stored on a day.
- Weeks are declared explicitly in `weeks[]` so a month can open/close mid-week with a prorated target. `weekStartsOn` (0=Sun) keeps the app, leaderboard, and Cloud Functions slicing the calendar identically.
- Cloud Function pushes route to `buildWeeklyNotification()` — the day-based copy talks about a daily target that doesn't exist.
- Feed posts fire on **week completion** (`weekCompleteFeedPost`), not day completion, since every logged day would otherwise "complete".

### Trophies are unit-agnostic
`shared/src/trophies.ts` scores in whatever `getTrophyUnit(challenge)` returns — days normally, **reps** on weekly-cumulative (whole weeks are too coarse a rung). Rungs: 🥉 50% / 🥈 **75%** / 🥇 100%.
`ChallengeTemplate.trophyStyle` re-skins tier emoji/labels per challenge (August: Bronze/Silver/Gold **Bicep**) without touching thresholds or who earned what. Use `getTrophyTier(tier, challenge)` — passing the challenge is what applies the theme.

### Challenge badges are data
`ChallengeBadgeDef.criteria` supports `complete-challenge`, `complete-days`, `challenge-reps`, `exercise-reps`, `single-day-reps`, `weeks-completed`, `week-variety`, `week-early`. Add a case in `criteriaRule()` (achievements.ts) and every future challenge gets it for free.

### Optional weight (`DailyLog.load`)
One weight per log, not per exercise — deliberately coarse. `formatLoad()` renders the leaderboard badge (`2×25`, `1×35`, `65 lb`, `BW`). Never affects scoring.
`src/lib/challenges.ts` and `src/types/index.ts` re-export everything from `@f3-bedrock/shared`.
`functions/src/index.ts` imports directly from `@f3-bedrock/shared` (bundled by esbuild at build time).

## Notifications Architecture
- **Scheduled via Firebase** `onSchedule("*/10 * * * *")` — NOT Vercel Cron (Hobby plan = 1/day max)
- `vercel.json` is intentionally `{}` (empty)
- Notifications are **algorithmic** (no AI/OpenAI) — template arrays varied by `dayNumber` so the same user gets different messages each day
- Notification log in Firestore `notificationLog` collection prevents duplicates; client writes are blocked by rules
- Shoutout/mention notifications triggered by `onFeedPostCreated` Cloud Function — **do not also write notifications client-side** (double-notification bug)

## Firestore Rules Summary
- Trust-based: allow all reads/writes
- `feed` collection: blocks hard deletes (soft delete via `deleted: true` field)
- `notificationLog`: blocks client writes (only Cloud Functions can write)

## Debug Logging
Uses a local ngrok tunnel to capture logs from deployed Vercel builds and real devices.

### Setup (already configured — just needs services running)
- Local log server: `.claude-debug/server.js` on port 3333, writes to `.claude-debug/debug.log`
- ngrok exposes port 3333 publicly — URL is `https://example.ngrok-free.app` (may change if ngrok restarts)
- `NEXT_PUBLIC_DEBUG_URL` is set in both `.env.local` (local dev) and the Vercel dashboard (production)
- After changing the ngrok URL: update `.env.local` AND Vercel → Settings → Environment Variables, then redeploy

### Starting the services
```bash
node .claude-debug/server.js        # start log receiver on :3333
# ngrok is already running — check with:
curl -s http://localhost:4040/api/tunnels | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['tunnels'][0]['public_url'])"
```

### Pattern used throughout the codebase
```typescript
const DBG = process.env.NEXT_PUBLIC_DEBUG_URL
function dbg(label: string, data: unknown) {
  if (!DBG) return
  fetch(DBG, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label, src: 'MyComponent', data }) }).catch(() => {})
}
```
Works in both client components and Next.js API routes — `NEXT_PUBLIC_` vars are available server-side too.

## Key Files
| Path | Purpose |
|------|---------|
| `shared/src/challenges.ts` | **Challenge data + helpers — single source of truth** |
| `shared/src/types.ts` | Exercise, ChallengeTemplate, DailyTarget types |
| `src/types/index.ts` | All app TypeScript types (re-exports challenge types from shared) |
| `src/lib/challenges.ts` | Re-exports everything from @f3-bedrock/shared |
| `src/lib/firebase-admin.ts` | Lazy Admin SDK proxy |
| `src/lib/firestore.ts` | All Firestore read/write helpers |
| `src/lib/storage.ts` | localStorage user session cache |
| `src/lib/utils.ts` | stripUndefined, formatDate, timeAgo, calculateStreak, etc. |
| `src/contexts/UserContext.tsx` | currentUser, allUsers, login, logout, refreshCurrentUser |
| `src/app/layout.tsx` | Root layout: QueryProvider > UserProvider > TooltipProvider |
| `src/app/page.tsx` | Home: daily log, PAX completion count, shoutout section |
| `src/app/onboarding/page.tsx` | 7-step wizard (pwa-install is step 1, auto-skips if already installed) |
| `src/app/settings/page.tsx` | Settings root |
| `src/app/settings/notifications/page.tsx` | Notification preferences |
| `src/app/settings/notifications/troubleshoot/page.tsx` | Notification setup diagnostics + test send |
| `src/app/api/notifications/test/route.ts` | POST — sends a test push to the user's FCM tokens |
| `functions/src/index.ts` | All Cloud Functions |
| `public/firebase-messaging-sw.js` | FCM service worker |
| `firestore.rules` | Firestore security rules |
| `firestore.indexes.json` | Composite indexes |

## iOS/Android Notes
- iOS: ads and premium features are Android-only
- PWA install is required for push notifications on iOS (must use Safari, iOS 16.4+)
- `PWAInstallStep` component is platform-aware (ios/android/installed/other); shared `PWAInstallGuide` component used by both onboarding and the troubleshoot page

## Deployment
- **Production URL**: `https://f3challenges.com` (Vercel Hobby, apex — no `www`)
- **Legacy origin**: `https://f3-bedrock-monthly-challenge.vercel.app` still *serves* the app (a Vercel alias, deliberately NOT a redirect — a cross-origin 301 kicks installed PWAs out of standalone mode). It shows the migration takeover. See `docs/MULTI_REGION.md`.
- **Vercel** — auto-deploys from `main` branch push
- **Firebase Functions + Firestore** — auto-deployed by GitHub Actions (`.github/workflows/firebase-deploy.yml`) on push to `main`; no local deploy needed
- Firebase project: `f3-bedrock-monthly-challenge`
- All env vars must be set in Vercel dashboard (copy from `.env.local`)

### shared/ package notes
- `functions/` is NOT in `pnpm-workspace.yaml` — it has its own `pnpm-lock.yaml` and `pnpm-workspace.yaml` (empty, makes it a standalone root so Firebase Cloud Build can install deps)
- `@f3-bedrock/shared` is resolved by esbuild via `--alias` flag at build time — it is NOT in `functions/package.json` and is NOT installed on the server
- `functions/tsconfig.json` has a `paths` entry for `@f3-bedrock/shared` pointing to `../shared/src/index.ts` for local type checking
