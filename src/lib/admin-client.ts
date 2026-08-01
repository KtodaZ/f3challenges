'use client'

import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth'
import { app } from '@/lib/firebase'
import type { AdminRecord } from '@/lib/admin-auth'

/**
 * Client half of admin auth. Only imported by pages under /admin, so the
 * `firebase/auth` bundle never reaches the PAX app.
 */

export function adminAuthClient() {
  return getAuth(app)
}

/**
 * Must be called straight from a click handler. Any `await` before
 * `signInWithPopup` breaks the user-gesture chain and popup blockers eat it —
 * which presents as "the button does nothing".
 */
export function signInWithGoogle() {
  const provider = new GoogleAuthProvider()
  // Always show the chooser: admins routinely have a personal and an F3 account
  // signed in, and silently reusing the wrong one looks like a permissions bug.
  provider.setCustomParameters({ prompt: 'select_account' })
  return signInWithPopup(adminAuthClient(), provider)
}

export function signOutAdmin() {
  return signOut(adminAuthClient())
}

export function onAdminAuthChanged(cb: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(adminAuthClient(), cb)
}

/** Authenticated fetch against /api/admin/*. */
export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const user = adminAuthClient().currentUser
  if (!user) throw new Error('Not signed in')
  const token = await user.getIdToken()

  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`)
  return body as T
}

export interface SessionResponse {
  uid: string
  email: string
  record: AdminRecord
}

/** Who am I, and am I allowed in? Also performs first-run bootstrap. */
export function fetchAdminSession(): Promise<SessionResponse> {
  return adminFetch<SessionResponse>('/api/admin/session', { method: 'POST' })
}
