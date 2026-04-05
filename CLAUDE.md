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
Uses a local ngrok tunnel for observing logs from deployed Vercel builds and devices.

- Local server: `.claude-debug/server.js` (runs on port 3333, logs to `.claude-debug/debug.log`)
- Env var: `NEXT_PUBLIC_DEBUG_URL` — set to the ngrok public URL pointing at port 3333
- Pattern used throughout the codebase:
  ```typescript
  const DBG = process.env.NEXT_PUBLIC_DEBUG_URL
  function dbg(label: string, data: unknown) {
    if (!DBG) return
    fetch(DBG, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label, src: 'MyComponent', data }) }).catch(() => {})
  }
  ```
- Works in both client components and Next.js API routes (server-side) — `NEXT_PUBLIC_` vars are available in both
- To start: `node .claude-debug/server.js` and expose via ngrok, then set `NEXT_PUBLIC_DEBUG_URL` in Vercel dashboard

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
| `src/app/onboarding/page.tsx` | 7-step wizard |
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
- `PWAInstallStep` component is platform-aware (ios/android/installed/other)

## Deployment
- **Vercel** — auto-deploys from `main` branch push
- **Firebase Functions** — build with esbuild (bundles `@f3-bedrock/shared` inline), then deploy
- **Firestore** — `firebase deploy --only firestore`
- Firebase project: `f3-bedrock-monthly-challenge`
- All env vars must be set in Vercel dashboard (copy from `.env.local`)

**Claude is responsible for Firebase deploys after making changes to functions.**
After editing `functions/src/index.ts` or `shared/src/challenges.ts`, always run:
```
cd functions && pnpm build && cd .. && firebase deploy --only functions --force
```

### shared/ package notes
- `functions/` is NOT in `pnpm-workspace.yaml` — it has its own `pnpm-lock.yaml` and `pnpm-workspace.yaml` (empty, makes it a standalone root so Firebase Cloud Build can install deps)
- `@f3-bedrock/shared` is resolved by esbuild via `--alias` flag at build time — it is NOT in `functions/package.json` and is NOT installed on the server
- `functions/tsconfig.json` has a `paths` entry for `@f3-bedrock/shared` pointing to `../shared/src/index.ts` for local type checking
