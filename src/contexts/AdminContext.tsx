'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { onAdminAuthChanged, fetchAdminSession, signOutAdmin, type SessionResponse } from '@/lib/admin-client'

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
        setState({ status: 'signed-out' })
        return
      }
      setState({ status: 'loading' })
      try {
        const session = await fetchAdminSession()
        if (!cancelled) setState({ status: 'ready', session })
      } catch (err) {
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
    setState({ status: 'signed-out' })
  }, [])

  return (
    <AdminContext.Provider value={{ state, refresh, signOut }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider')
  return ctx
}
