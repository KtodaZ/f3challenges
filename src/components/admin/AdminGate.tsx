'use client'

import { useState } from 'react'
import { useAdmin } from '@/contexts/AdminContext'
import { signInWithGoogle } from '@/lib/admin-client'
import { Button } from '@/components/ui/Button'
import { AdminNav } from '@/components/admin/AdminNav'

/**
 * Sign-in wall for the admin panel. Renders the panel only once the server has
 * confirmed the caller is on the admin list — but note that every admin route
 * re-checks independently, because this component is just UI.
 */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const { state, signOut } = useAdmin()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // No `await` before signInWithPopup — the popup has to open inside the click
  // gesture or the browser blocks it, which looks like a dead button.
  function handleSignIn() {
    setError(null)
    setBusy(true)
    signInWithGoogle()
      .catch((err: { code?: string; message?: string }) => {
        if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return
        setError(
          err.code === 'auth/popup-blocked'
            ? 'Your browser blocked the sign-in popup. Allow popups for this site and try again.'
            : err.message ?? 'Sign-in failed'
        )
      })
      .finally(() => setBusy(false))
  }

  if (state.status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (state.status === 'signed-out' || state.status === 'denied') {
    return (
      <div className="flex items-center justify-center min-h-dvh px-6">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-black text-white mb-1">Admin</h1>
          <p className="text-sm text-zinc-500 mb-8">F3 Norcal Monthly Challenge</p>

          {state.status === 'denied' ? (
            <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-left">
              <p className="text-sm text-white font-medium mb-1">Not an admin</p>
              <p className="text-xs text-zinc-500">
                {state.email
                  ? <>Signed in as <span className="text-zinc-300">{state.email}</span>, which isn&apos;t on the admin list. Ask an existing admin to add you, or sign in with a different account.</>
                  : state.reason}
              </p>
            </div>
          ) : (
            <p className="text-sm text-zinc-400 mb-8">
              Sign in with the Google account an admin has added.
            </p>
          )}

          <Button variant="primary" size="lg" fullWidth onClick={handleSignIn} loading={busy}>
            {state.status === 'denied' ? 'Try another account' : 'Sign in with Google'}
          </Button>

          {state.status === 'denied' && (
            <button
              onClick={signOut}
              className="mt-4 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Sign out
            </button>
          )}

          {error && <p className="mt-4 text-xs text-red-400">{error}</p>}

          <p className="mt-10 text-xs text-zinc-700">
            Best on a desktop browser — sign-in popups are unreliable in an
            installed app on mobile.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh">
      <AdminNav />
      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
