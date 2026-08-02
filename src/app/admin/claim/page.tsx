'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAdmin } from '@/contexts/AdminContext'
import { signInWithGoogle, adminFetch } from '@/lib/admin-client'
import { Button } from '@/components/ui/Button'

/**
 * Where an admin invite link lands.
 *
 * Sits outside the usual admin gate: whoever opens this is by definition not
 * an admin yet. They sign in with Google, the token is redeemed server-side,
 * and whichever account they used becomes the admin.
 */
function ClaimPageInner() {
  const router = useRouter()
  const { state, refresh } = useAdmin()

  const [token, setToken] = useState<string | null>(null)
  const [tokenRead, setTokenRead] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // A ref, not state: this only guards against redeeming twice and must never
  // itself trigger a render.
  const claimed = useRef(false)

  // Read the token from the URL and strip it immediately. Signing in navigates
  // cross-origin to accounts.google.com, and a URL that grants admin access has
  // no business sitting in browser history, in server access logs, or in a
  // Referer header while that happens.
  //
  // Read from window rather than useSearchParams: this has to happen in an
  // effect anyway (there's no URL during prerender), and going direct means the
  // page needs no Suspense boundary.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('t')
    if (t) window.history.replaceState({}, '', '/admin/claim')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(t)
    setTokenRead(true)
  }, [])

  const signedIn = state.status === 'denied' || state.status === 'ready'

  // Once signed in, redeem automatically — an extra "now click claim" step
  // after the Google popup is pure friction.
  useEffect(() => {
    if (!token || claimed.current || !signedIn) return

    claimed.current = true
    adminFetch('/api/admin/invites/claim', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then(() => { refresh(); router.replace('/admin') })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not use this invite'))
  }, [token, signedIn, refresh, router])

  function handleSignIn() {
    setError(null)
    setBusy(true)
    signInWithGoogle()
      .catch((err: { code?: string; message?: string }) => {
        if (err.code === 'auth/popup-closed-by-user') return
        setError(err.message ?? 'Sign-in failed')
      })
      .finally(() => setBusy(false))
  }

  if (error) {
    return <Message title="This invite didn't work" body={error} />
  }
  // Don't judge the token until the effect has actually looked for it —
  // otherwise the first paint accuses a perfectly good link of being broken.
  if (!tokenRead) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!token) {
    return <Message title="Invite link is incomplete" body="That link is missing its code. Ask for a fresh one." />
  }
  // Signed in with no error means the redemption is in flight.
  if (state.status === 'loading' || signedIn) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-dvh px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-black text-white mb-2">You&apos;ve been invited</h1>
        <p className="text-sm text-zinc-400 mb-8">
          Sign in with Google to become an admin for the F3 Norcal Monthly Challenge.
          Whichever account you pick is the one that gets access.
        </p>
        <Button variant="primary" size="lg" fullWidth onClick={handleSignIn} loading={busy}>
          Sign in with Google
        </Button>
        <p className="mt-10 text-xs text-zinc-700">
          Best on a desktop browser — sign-in popups are unreliable inside an installed app.
        </p>
      </div>
    </div>
  )
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex items-center justify-center min-h-dvh px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-xl font-bold text-white mb-2">{title}</h1>
        <p className="text-sm text-zinc-500">{body}</p>
      </div>
    </div>
  )
}

export default function ClaimPage() {
  // No Suspense boundary needed: the token is read from window.location in an
  // effect rather than via useSearchParams.
  return <ClaimPageInner />
}
