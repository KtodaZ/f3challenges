'use client'

/**
 * Moving to f3challenges.com — without forcing anyone to reinstall.
 *
 * The old `*.vercel.app` origin stays attached to the Vercel project as a
 * second alias, so an already-installed PWA keeps working exactly as before:
 * same deployment, same Firestore, same Firebase project. Push notifications
 * still land, because `fcmOptions.link` is a relative path (`/feed`) that
 * resolves against whichever origin registered the service worker.
 *
 * So there is nothing to migrate. New PAX get f3challenges.com; existing
 * installs carry on where they are. The only thing NOT to do is turn the old
 * origin into a redirect — a cross-origin 301 kicks an installed PWA out of
 * standalone mode.
 *
 * What remains here is the claim link: `?claim=<userId>` restores a session
 * without re-picking a name from the roster. That's genuinely useful for a new
 * phone, or for anyone who does choose to move across.
 */

/** Where the app lives now — new installs and shared links point here. */
export const CANONICAL_HOST =
  process.env.NEXT_PUBLIC_CANONICAL_HOST ?? 'f3challenges.com'

export function canonicalOrigin(): string {
  return `https://${CANONICAL_HOST}`
}

/** A link that lands a PAX signed in as themselves, skipping onboarding. */
export function claimUrl(userId: string): string {
  return `${canonicalOrigin()}/?claim=${encodeURIComponent(userId)}`
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
