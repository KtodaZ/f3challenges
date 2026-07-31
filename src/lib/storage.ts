/**
 * localStorage helpers for client-side session state.
 * No auth — users simply select or create their identity.
 */

const CURRENT_USER_KEY  = 'f3_current_user_id'
const ONBOARDING_KEY    = 'f3_onboarding_complete'
const CACHED_USER_KEY   = 'f3_cached_user'
const REGION_KEY        = 'f3_region_id'

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

export function clearCachedUser(): void {
  localStorage.removeItem(CACHED_USER_KEY)
}
