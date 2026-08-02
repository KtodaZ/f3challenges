'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { onAdminAuthChanged, fetchAdminSession, signOutAdmin, AdminRevokedError, type SessionResponse } from '@/lib/admin-client'
import { setKnownAdmin } from '@/lib/storage'

type AdminState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  /** Signed in with Google, but not on the admin list. */
  | { status: 'denied'; email: string; reason: string }
  | { status: 'ready'; session: SessionResponse }

interface AdminContextValue {
  state: AdminState
  refresh: () => void
  signOut: () => Promise<void>
  /**
   * Report a failed admin call. A 401/403 means access ended while the panel
   * was open, so the panel drops back to the sign-in wall instead of
   * continuing to render as though the caller still has access.
   */
  reportFailure: (err: unknown) => void
}

const AdminContext = createContext<AdminContextValue | null>(null)

/**
 * Admin session, scoped to /admin only — mounted by the admin layout, never by
 * the PAX app.
 *
 * Authorization is re-checked server-side on every request; this context only
 * decides what to render. Nothing here is a security boundary.
 */
export function AdminProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AdminState>({ status: 'loading' })
  const [nonce, setNonce] = useState(0)

  const refresh = useCallback(() => setNonce(n => n + 1), [])

  useEffect(() => {
    let cancelled = false

    const unsub = onAdminAuthChanged(async user => {
      if (cancelled) return
      if (!user) {
        setKnownAdmin(false)
        setState({ status: 'signed-out' })
        return
      }
      setState({ status: 'loading' })
      try {
        const session = await fetchAdminSession()
        // Lets Settings show the Admin link on this device. See storage.ts —
        // it's a display hint, never a permission.
        setKnownAdmin(true)
        if (!cancelled) setState({ status: 'ready', session })
      } catch (err) {
        setKnownAdmin(false)
        if (!cancelled) {
          setState({
            status: 'denied',
            email: user.email ?? '',
            reason: err instanceof Error ? err.message : 'Not an admin',
          })
        }
      }
    })

    return () => { cancelled = true; unsub() }
  }, [nonce])

  const signOut = useCallback(async () => {
    await signOutAdmin()
    setKnownAdmin(false)
    setState({ status: 'signed-out' })
  }, [])

  const reportFailure = useCallback((err: unknown) => {
    if (!(err instanceof AdminRevokedError)) return
    // Revoked mid-session: stop advertising the link too.
    setKnownAdmin(false)
    setState(prev => {
      const email = prev.status === 'ready' ? prev.session.email
        : prev.status === 'denied' ? prev.email
        : ''
      return { status: 'denied', email, reason: err.message }
    })
  }, [])

  return (
    <AdminContext.Provider value={{ state, refresh, signOut, reportFailure }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider')
  return ctx
}
