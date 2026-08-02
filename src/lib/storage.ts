/**
 * localStorage helpers for client-side session state.
 * No auth — users simply select or create their identity.
 */

const CURRENT_USER_KEY  = 'f3_current_user_id'
const ONBOARDING_KEY    = 'f3_onboarding_complete'
const CACHED_USER_KEY   = 'f3_cached_user'
const REGION_KEY        = 'f3_region_id'
const ADMIN_HINT_KEY    = 'f3_admin'

export function getCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(CURRENT_USER_KEY)
}

export function setCurrentUserId(userId: string): void {
  localStorage.setItem(CURRENT_USER_KEY, userId)
}

export function clearCurrentUserId(): void {
  localStorage.removeItem(CURRENT_USER_KEY)
}

// Which region this device is browsing. Written at onboarding (or by an
// ?region= invite link) and kept in sync with the signed-in user's regionId.
export function getStoredRegionId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REGION_KEY)
}

export function setStoredRegionId(regionId: string): void {
  localStorage.setItem(REGION_KEY, regionId)
}

export function clearStoredRegionId(): void {
  localStorage.removeItem(REGION_KEY)
}

export function isOnboardingComplete(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(ONBOARDING_KEY) === 'true'
}

export function setOnboardingComplete(): void {
  localStorage.setItem(ONBOARDING_KEY, 'true')
}

// Cache the full user object so the app loads instantly without a Firestore round-trip
export function getCachedUser<T>(): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHED_USER_KEY)
    return raw ? (JSON.parse(raw) as T) : null
  } catch { return null }
}

export function setCachedUser<T>(user: T): void {
  localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user))
}

// ─── Admin hint ──────────────────────────────────────────────────────────────
// Set when this device successfully loads an admin session, cleared when that
// session ends or is refused. Its only job is deciding whether Settings shows
// the Admin link.
//
// A hint, deliberately, not a check. The PAX app never loads Firebase Auth —
// only /admin does — so asking "is this person an admin?" properly here would
// pull the whole auth bundle in front of every PAX to hide one link. Nothing
// is protected by this: /admin re-verifies with the server on arrival, and
// every admin endpoint re-reads admins/{uid} on every request. Someone who
// forges the flag sees a link that takes them to a sign-in wall.

export function isKnownAdmin(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(ADMIN_HINT_KEY) === 'true'
}

export function setKnownAdmin(value: boolean): void {
  if (value) localStorage.setItem(ADMIN_HINT_KEY, 'true')
  else localStorage.removeItem(ADMIN_HINT_KEY)
}

export function clearCachedUser(): void {
  localStorage.removeItem(CACHED_USER_KEY)
}
