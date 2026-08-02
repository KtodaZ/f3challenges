'use client'

import { useCallback, useEffect, useState } from 'react'
import { isKnownAdmin, setKnownAdmin } from '@/lib/storage'

/**
 * Admin powers, inside the normal PAX app.
 *
 * Moderating from the feed you're already reading beats navigating to a
 * separate page — you notice a problem where it happens. The catch is that the
 * PAX app is unauthenticated and knows nothing about admins, while every admin
 * action needs a Firebase ID token.
 *
 * So this is gated twice:
 *
 * 1. A localStorage hint (`isKnownAdmin`), written when a device successfully
 *    loads an admin session. Cheap, synchronous, and wrong-in-the-safe-
 *    direction: it decides only whether we bother looking further.
 * 2. If the hint is set, `firebase/auth` is **dynamically imported** and the
 *    session re-verified against the server. `isAdmin` flips true only after
 *    that succeeds.
 *
 * The dynamic import is the point: without it, adding moderation to the feed
 * would ship the whole auth bundle to all 39 PAX so that one or two could use
 * it. This way nobody downloads it unless they've actually signed in as an
 * admin on this device.
 *
 * None of this is a permission check. The buttons it reveals call server
 * routes that re-read `admins/{uid}` on every request; a PAX who forges the
 * flag gets buttons that return 403.
 */
export interface AdminModeState {
  /** Verified against the server, not just the localStorage hint. */
  isAdmin: boolean
  /** Superadmin gates things a region admin has no business doing — notably
   *  viewing another region's app. Absent until verification completes. */
  role?: 'superadmin' | 'regionAdmin'
  /** Regions a regionAdmin governs; empty for a superadmin, who governs all. */
  regionIds: string[]
}

export function useAdminMode() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [role, setRole] = useState<'superadmin' | 'regionAdmin' | undefined>()
  const [regionIds, setRegionIds] = useState<string[]>([])

  useEffect(() => {
    if (!isKnownAdmin()) return

    let cancelled = false
    let unsub: (() => void) | undefined

    import('@/lib/admin-client').then(mod => {
      if (cancelled) return
      unsub = mod.onAdminAuthChanged(async user => {
        if (!user) {
          setKnownAdmin(false)
          if (!cancelled) { setIsAdmin(false); setRole(undefined) }
          return
        }
        try {
          const session = await mod.fetchAdminSession()
          if (!cancelled) {
            setIsAdmin(true)
            setRole(session.record.role)
            setRegionIds(session.record.regionIds ?? [])
          }
        } catch {
          // Signed in to Google but no longer an admin — stop showing controls
          // and stop paying for this check on future loads.
          setKnownAdmin(false)
          if (!cancelled) { setIsAdmin(false); setRole(undefined) }
        }
      })
    }).catch(() => {
      // Chunk failed to load; behave as a normal PAX.
    })

    return () => { cancelled = true; unsub?.() }
  }, [])

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

  return { isAdmin, role, regionIds, removePost, removeComment }
}
