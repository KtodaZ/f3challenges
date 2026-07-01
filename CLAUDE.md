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
- **Production URL**: `https://f3-bedrock-monthly-challenge.vercel.app`
- **Vercel** — auto-deploys from `main` branch push
- **Firebase Functions + Firestore** — auto-deployed by GitHub Actions (`.github/workflows/firebase-deploy.yml`) on push to `main`; no local deploy needed
- Firebase project: `f3-bedrock-monthly-challenge`
- All env vars must be set in Vercel dashboard (copy from `.env.local`)

### shared/ package notes
- `functions/` is NOT in `pnpm-workspace.yaml` — it has its own `pnpm-lock.yaml` and `pnpm-workspace.yaml` (empty, makes it a standalone root so Firebase Cloud Build can install deps)
- `@f3-bedrock/shared` is resolved by esbuild via `--alias` flag at build time — it is NOT in `functions/package.json` and is NOT installed on the server
- `functions/tsconfig.json` has a `paths` entry for `@f3-bedrock/shared` pointing to `../shared/src/index.ts` for local type checking
