'use client'

/**
 * Domain migration: f3-bedrock-monthly-challenge.vercel.app → f3challenges.com
 *
 * An installed PWA is bound to its origin, so the new domain is a different app
 * to the browser: localStorage doesn't carry over, and FCM tokens are tied to
 * the service worker registration at the old origin. Left alone, a PAX ends up
 * with two installs — and the *old* one keeps receiving the push notifications.
 *
 * The flow:
 *   1. The old origin keeps serving the app (a Vercel alias, NOT a redirect —
 *      a cross-origin 301 kicks an installed PWA out of standalone mode).
 *   2. On the old origin, MigrationGate takes over the screen with reinstall
 *      instructions and a one-time claim link.
 *   3. The claim link carries the user id, so nobody re-picks their name on the
 *      new origin. It also stamps `migratedAt` on the user.
 *   4. Back on the old origin, `migratedAt` triggers self-cleanup: delete this
 *      origin's FCM token and unregister its service worker, which is what
 *      actually stops double-push.
 */

import { getToken, deleteToken } from 'firebase/messaging'
import { getMessagingInstance } from './firebase'

/** Where the app lives now. */
export const CANONICAL_HOST =
  process.env.NEXT_PUBLIC_CANONICAL_HOST ?? 'f3challenges.com'

/**
 * Origins that still serve the app but should hand their users over. Only
 * exact hosts — localhost and Vercel preview URLs must never trigger the
 * takeover, or local development and PR previews become unusable.
 */
export const LEGACY_HOSTS = ['f3-bedrock-monthly-challenge.vercel.app']

/** Session-scoped escape hatch, so "keep using the old app" lasts one visit. */
const SNOOZE_KEY = 'f3_migration_snoozed'

export function isLegacyOrigin(): boolean {
  if (typeof window === 'undefined') return false
  return LEGACY_HOSTS.includes(window.location.host)
}

export function canonicalOrigin(): string {
  return `https://${CANONICAL_HOST}`
}

/** The one-time handover link for a specific PAX. */
export function claimUrl(userId: string): string {
  return `${canonicalOrigin()}/?claim=${encodeURIComponent(userId)}`
}

export function isMigrationSnoozed(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(SNOOZE_KEY) === 'true'
}

export function snoozeMigration(): void {
  sessionStorage.setItem(SNOOZE_KEY, 'true')
}

/**
 * Reads and clears a `?claim=<userId>` param. Returns the user id so the
 * caller can restore the session without an onboarding round-trip.
 *
 * Strips the param from the URL immediately: it's a handover token, and
 * leaving it in the address bar means it gets bookmarked, shared, or re-fired
 * on every reload.
 */
export function consumeClaimParam(): string | null {
  if (typeof window === 'undefined') return null
  const url = new URL(window.location.href)
  const claim = url.searchParams.get('claim')
  if (!claim) return null
  url.searchParams.delete('claim')
  window.history.replaceState({}, '', url.toString())
  return claim
}

export type MigrationPlatform = 'ios' | 'android' | 'other'

export function detectMigrationPlatform(): MigrationPlatform {
  if (typeof window === 'undefined') return 'other'
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'other'
}

/** True when the app is running as an installed PWA rather than a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as { standalone?: boolean }).standalone === true
}

/**
 * Retires this origin's push registration. Called on the OLD origin once the
 * user has claimed their account on the new one.
 *
 * Order matters: pull the token out of Firestore *before* deleting it locally,
 * because deleteToken() makes it unrecoverable and a token left in the array
 * would keep receiving sends until FCM reports it unregistered.
 */
export async function retireLegacyPushRegistration(userId: string): Promise<void> {
  try {
    const messaging = await getMessagingInstance()
    if (messaging) {
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
      // Only look up an existing token — never prompt for permission here.
      const token = Notification.permission === 'granted'
        ? await getToken(messaging, { vapidKey }).catch(() => null)
        : null

      if (token) {
        await fetch('/api/fcm/unregister', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, token }),
        }).catch(() => {})
        await deleteToken(messaging).catch(() => {})
      }
    }
  } catch {
    // Best effort — a failure here means one stale token, not a broken app.
  }

  try {
    const registrations = await navigator.serviceWorker?.getRegistrations?.()
    await Promise.all((registrations ?? []).map(r => r.unregister()))
  } catch {
    // Same — the user deleting the old icon achieves the same thing.
  }
}
