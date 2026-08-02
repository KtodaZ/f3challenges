'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { isKnownAdmin, setKnownAdmin } from '@/lib/storage'
import { useRegion } from '@/contexts/RegionContext'

/**
 * Admin powers inside the normal PAX app.
 *
 * Moderating from the feed you're already reading beats navigating to a
 * separate page — you notice a problem where it happens. The catch is that the
 * PAX app is unauthenticated and knows nothing about admins, while every admin
 * action needs a Firebase ID token.
 *
 * Gated twice:
 *
 * 1. A localStorage hint (`isKnownAdmin`), written when a device successfully
 *    loads an admin session. Cheap, synchronous, and only decides whether we
 *    bother looking further.
 * 2. If the hint is set, `firebase/auth` is **dynamically imported** and the
 *    session re-verified against the server. `isAdmin` flips true only after
 *    that succeeds.
 *
 * The dynamic import is the point: without it, adding moderation to the feed
 * would ship the whole auth bundle to every PAX so that one or two could use
 * it. This way nobody downloads it unless they've actually signed in as an
 * admin on this device.
 *
 * **This is a provider rather than a plain hook for a reason.** It was a hook,
 * and `FeedPost` calls it once per post — a 30-post feed opened 30 auth
 * listeners and fired 30 `/api/admin/session` requests on every render, more
 * once comment threads mounted. Hoisting it means one listener and one request
 * per session no matter how long the feed gets.
 *
 * None of this is a permission check. The controls it reveals call server
 * routes that re-read `admins/{uid}` on every request; a PAX who forges the
 * flag gets buttons that return 403.
 */

interface AdminModeValue {
  /** Verified against the server, not just the localStorage hint. */
  isAdmin: boolean
  /** Superadmin gates things a region admin has no business doing — notably
   *  previewing another region. Absent until verification completes. */
  role?: 'superadmin' | 'regionAdmin'
  /** Regions a regionAdmin governs; empty for a superadmin, who governs all. */
  regionIds: string[]
  removePost: (postId: string) => Promise<void>
  removeComment: (postId: string, commentId: string) => Promise<void>
}

const AdminModeContext = createContext<AdminModeValue | null>(null)

export function AdminModeProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [role, setRole] = useState<'superadmin' | 'regionAdmin' | undefined>()
  const [regionIds, setRegionIds] = useState<string[]>([])
  // Whether verification has finished, either way. Distinguishes "not a
  // superadmin" from "we don't know yet", which matters below.
  const [checked, setChecked] = useState(false)
  const { viewingAs, setViewingAs } = useRegion()

  useEffect(() => {
    if (!isKnownAdmin()) {
      setChecked(true)
      return
    }

    let cancelled = false
    let unsub: (() => void) | undefined

    import('@/lib/admin-client').then(mod => {
      if (cancelled) return
      unsub = mod.onAdminAuthChanged(async user => {
        if (!user) {
          // No Firebase session. Deliberately does NOT clear the hint: this is
          // the same signal for "signed out" and for "Safari evicted the auth
          // IndexedDB", which it does after 7 days of not visiting — including
          // for installed PWAs. Clearing here would silently remove the only
          // in-app route to /admin from an admin who simply hadn't opened the
          // app in a fortnight. The hint grants nothing; /admin re-verifies on
          // arrival. It's cleared on explicit sign-out and on a refused
          // session, which are the two unambiguous cases.
          if (!cancelled) { setIsAdmin(false); setRole(undefined); setRegionIds([]); setChecked(true) }
          return
        }
        try {
          const session = await mod.fetchAdminSession()
          if (!cancelled) {
            setIsAdmin(true)
            setRole(session.record.role)
            setRegionIds(session.record.regionIds ?? [])
            setChecked(true)
          }
        } catch (err) {
          // Only a definitive "you are not an admin" clears the hint. A network
          // blip or a 500 must not, or one bad request permanently hides the
          // controls until the next visit to /admin.
          if (err instanceof mod.AdminRevokedError) setKnownAdmin(false)
          if (!cancelled) { setIsAdmin(false); setRole(undefined); setRegionIds([]); setChecked(true) }
        }
      })
    }).catch(() => {
      // Chunk failed to load — behave as a normal PAX and try again next load.
      if (!cancelled) setChecked(true)
    })

    return () => { cancelled = true; unsub?.() }
  }, [])

  // Region preview restores itself from sessionStorage before anyone has been
  // verified, so it has to be revoked here once we know. Otherwise a revoked
  // superadmin — or anyone who set the key by hand — stays parked in another
  // region's app after a reload. Reads there are no more privileged than any
  // PAX's, and writes are already blocked, but the app shouldn't present a
  // region as yours when it isn't.
  useEffect(() => {
    if (!checked || !viewingAs) return
    if (role !== 'superadmin') setViewingAs(null)
  }, [checked, viewingAs, role, setViewingAs])

  /** Soft-delete any post. Audited server-side, unlike an author's own delete. */
  const removePost = useCallback(async (postId: string) => {
    const { adminFetch } = await import('@/lib/admin-client')
    await adminFetch(`/api/admin/feed/${postId}`, { method: 'DELETE' })
  }, [])

  /** Soft-delete any comment on a post. */
  const removeComment = useCallback(async (postId: string, commentId: string) => {
    const { adminFetch } = await import('@/lib/admin-client')
    await adminFetch(`/api/admin/feed/${postId}?commentId=${commentId}`, { method: 'DELETE' })
  }, [])

  return (
    <AdminModeContext.Provider value={{ isAdmin, role, regionIds, removePost, removeComment }}>
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
 * be rendered in both trees.
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
