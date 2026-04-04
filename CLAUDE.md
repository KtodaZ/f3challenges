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
- **OpenAI gpt-4o-mini** — lazy client init in `functions/src/index.ts`
- **Radix UI**: dialog, dropdown-menu, switch, tooltip, slot
- **Sonner** for toasts
- **TanStack Query v5** with `isNetworkBlockedError()` retry logic
- **pnpm** as package manager

## Critical Patterns

### stripUndefined — always use before Firestore writes
```typescript
// src/lib/utils.ts
export function stripUndefined<T extends object>(obj: T): T
```
Optional TypeScript fields (notes, modificationNote, targetUserId) become `undefined` and crash Firestore with "Unsupported field value: undefined". Apply `stripUndefined()` before every `setDoc`/`updateDoc`.

### Firebase Admin lazy proxy
`src/lib/firebase-admin.ts` uses a `Proxy` so the Admin SDK only initializes on first access, not at module load time. Never import from firebase-admin directly in server code — always use `adminDb` and `adminMessaging` from this file.

### OpenAI lazy init
In `functions/src/index.ts`, the OpenAI client is created inside the function handler with `new OpenAI({ apiKey: openAiKey.value() })`, not at module level.

### functions/ local types
`functions/src/index.ts` defines its own minimal TypeScript interfaces (`DailyLog`, `ChallengeParticipation`, `User`, etc.) since it can't import from `src/types`. When adding fields to shared types, update both.

### Session persistence
`src/contexts/UserContext.tsx` loads cached user from `localStorage` immediately on mount (no async flash), then refreshes from Firestore in the background. Cache managed via `src/lib/storage.ts`.

## Challenge Template System
`src/lib/challenges.ts` — adding a new month = append one object to `CHALLENGES`. No other code changes needed.
```typescript
{ id: 'may-2026', name: '...', dailyMultiplier: X, exercises: [...], startDate: '2026-05-01', endDate: '2026-05-31' }
```

## Notifications Architecture
- **Scheduled via Firebase** `onSchedule("every 60 minutes")` — NOT Vercel Cron (Hobby plan = 1/day max)
- `vercel.json` is intentionally `{}` (empty)
- OpenAI generates personalized push notifications with peer pressure: passes `completedNames` and `notDoneNames` to the prompt
- Test script: `node scripts/test-notifications.mjs`
- Notification log in Firestore `notificationLog` collection prevents duplicates; client writes are blocked by rules

## Firestore Rules Summary
- Trust-based: allow all reads/writes
- `feed` collection: blocks hard deletes (soft delete via `deleted: true` field)
- `notificationLog`: blocks client writes (only Cloud Functions can write)

## Key Files
| Path | Purpose |
|------|---------|
| `src/types/index.ts` | All shared TypeScript types |
| `src/lib/challenges.ts` | Challenge template system |
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
| `functions/src/index.ts` | All Cloud Functions |
| `scripts/test-notifications.mjs` | Test AI notification prompt locally |
| `public/firebase-messaging-sw.js` | FCM service worker |
| `firestore.rules` | Firestore security rules |
| `firestore.indexes.json` | Composite indexes |

## iOS/Android Notes
- iOS: ads and premium features are Android-only
- PWA install is required for push notifications on iOS (must use Safari, iOS 16.4+)
- `PWAInstallStep` component is platform-aware (ios/android/installed/other)

## Deployment
- **Vercel** — auto-deploys from `main` branch push
- **Firebase Functions** — `firebase deploy --only functions --force` (must `pnpm build` in `functions/` first)
- **Firestore** — `firebase deploy --only firestore`
- Firebase project: `f3-bedrock-monthly-challenge`
- All env vars must be set in Vercel dashboard (copy from `.env.local`)
- OPENAI_API_KEY is a Firebase secret: `firebase functions:secrets:set OPENAI_API_KEY`

**Claude is responsible for Firebase deploys after making changes to functions.**
After editing `functions/src/index.ts`, always run:
```
cd functions && pnpm build && cd .. && firebase deploy --only functions --force
```
