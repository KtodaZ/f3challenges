'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useRegion } from '@/contexts/RegionContext'
import { useUser } from '@/contexts/UserContext'
import type { AdminStatusResponse } from '@/app/api/admin/status/route'

/**
 * Admin powers inside the normal PAX app.
 *
 * Moderating from the feed you're already reading beats navigating to a
 * separate page — you notice a problem where it happens.
 *
 * **How the app knows.** It asks the server: `/api/admin/status?userId=` looks
 * up whether the signed-in PAX is linked to an admin record. That's it. No
 * Firebase Auth, no bundle, nothing device-local.
 *
 * The device-local approach this replaced was a dead end. It keyed off a
 * localStorage flag written after a successful /admin session, so the controls
 * only appeared on a device that had already been to /admin — which a phone
 * never had, and which iOS wipes after a week of not opening the app. Asking
 * the server works on any device, immediately.
 *
 * **Signing in is deferred to the moment it's needed.** Showing the controls
 * costs nothing; performing an action needs a Google ID token. If there isn't
 * one, the action throws `AdminSignInRequiredError` and the UI points at
 * /admin. `firebase/auth` is still only pulled in by dynamic import, at that
 * point, so no PAX ever downloads it.
 *
 * None of this is a permission check. Every endpoint re-reads `admins/{uid}`
 * on every request; a PAX who fakes this gets buttons that return 403.
 */

export class AdminSignInRequiredError extends Error {
  constructor() {
    super('Sign in with Google at /admin on this device to make changes.')
    this.name = 'AdminSignInRequiredError'
  }
}

interface AdminModeValue {
  isAdmin: boolean
  /** Superadmin gates previewing another region. */
  role?: 'superadmin' | 'regionAdmin'
  /** Regions a regionAdmin governs; empty for a superadmin, who governs all. */
  regionIds: string[]
  removePost: (postId: string) => Promise<void>
  removeComment: (postId: string, commentId: string) => Promise<void>
}

const AdminModeContext = createContext<AdminModeValue | null>(null)

export function AdminModeProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useUser()
  const { viewingAs, setViewingAs } = useRegion()
  const [status, setStatus] = useState<AdminStatusResponse>({ isAdmin: false, regionIds: [] })
  // Distinguishes "not an admin" from "haven't asked yet", which the preview
  // guard below depends on.
  const [checked, setChecked] = useState(false)

  const userId = currentUser?.id
  useEffect(() => {
    if (!userId) return
    let cancelled = false

    fetch(`/api/admin/status?userId=${encodeURIComponent(userId)}`)
      .then(r => r.json() as Promise<AdminStatusResponse>)
      .then(s => { if (!cancelled) { setStatus(s); setChecked(true) } })
      .catch(() => { if (!cancelled) setChecked(true) })

    return () => { cancelled = true }
  }, [userId])

  // Region preview restores itself from sessionStorage before anyone has been
  // checked, so revoke it once we know. Otherwise a former superadmin stays
  // parked in another region's app across a reload.
  useEffect(() => {
    if (!checked || !viewingAs) return
    if (status.role !== 'superadmin') setViewingAs(null)
  }, [checked, viewingAs, status.role, setViewingAs])

  /**
   * Every admin mutation needs a Google ID token. Loading `firebase/auth` is
   * deferred to here so it never reaches a PAX who isn't acting as an admin.
   */
  const runAsAdmin = useCallback(async (path: string): Promise<void> => {
    const mod = await import('@/lib/admin-client')
    if (!mod.adminAuthClient().currentUser) throw new AdminSignInRequiredError()
    await mod.adminFetch(path, { method: 'DELETE' })
  }, [])

  /** Soft-delete any post. Audited server-side, unlike an author's own delete. */
  const removePost = useCallback(
    (postId: string) => runAsAdmin(`/api/admin/feed/${postId}`),
    [runAsAdmin]
  )

  /** Soft-delete any comment on a post. */
  const removeComment = useCallback(
    (postId: string, commentId: string) =>
      runAsAdmin(`/api/admin/feed/${postId}?commentId=${commentId}`),
    [runAsAdmin]
  )

  return (
    <AdminModeContext.Provider
      value={{
        isAdmin: status.isAdmin,
        role: status.role,
        regionIds: status.regionIds,
        removePost,
        removeComment,
      }}
    >
      {children}
    </AdminModeContext.Provider>
  )
}

/**
 * Safe to call from anywhere in the PAX app, including inside a list — it reads
 * context and starts nothing.
 *
 * Returns a dormant value outside the provider (e.g. under /admin, which
 * doesn't mount the PAX shell) rather than throwing, so a shared component can
 * render in both trees.
 */
export function useAdminMode(): AdminModeValue {
  const ctx = useContext(AdminModeContext)
  return ctx ?? {
    isAdmin: false,
    regionIds: [],
    removePost: async () => {},
    removeComment: async () => {},
  }
}
