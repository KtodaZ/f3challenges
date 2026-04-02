/**
 * localStorage helpers for client-side session state.
 * No auth — users simply select or create their identity.
 */

const CURRENT_USER_KEY = 'f3_current_user_id'
const ONBOARDING_KEY   = 'f3_onboarding_complete'

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

export function isOnboardingComplete(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(ONBOARDING_KEY) === 'true'
}

export function setOnboardingComplete(): void {
  localStorage.setItem(ONBOARDING_KEY, 'true')
}
