'use client'

import { useUser } from '@/contexts/UserContext'
import { isArchived } from '@/lib/roster'

/**
 * Stops the app for a PAX an admin has archived.
 *
 * The authoritative status comes from the live roster subscription, not the
 * cached user: `UserContext` already subscribes to every user in the region
 * (the directory, so archived PAX are included), which means an archive lands
 * here in realtime without a second listener. An open session shuts down when
 * it happens rather than waiting for a reload.
 *
 * The localStorage cache is still checked, so a device that reopens cold
 * blocks immediately instead of flashing the app while Firestore answers.
 *
 * This is not a lock. PAX are unauthenticated — an archived PAX can clear
 * their storage and onboard again under a different name, and nothing stops a
 * determined person writing to Firestore directly. It removes someone from the
 * crew; it doesn't lock the door. See docs/MULTI_REGION.md.
 */
export function ArchivedGate({ children }: { children: React.ReactNode }) {
  const { currentUser, allUsers, logout } = useUser()

  if (!currentUser) return <>{children}</>

  // Prefer the live doc; fall back to the cached copy before the roster lands.
  const live = allUsers.find(u => u.id === currentUser.id)
  if (!isArchived(live ?? currentUser)) return <>{children}</>

  return (
    <div className="flex items-center justify-center min-h-dvh px-6">
      <div className="w-full max-w-sm text-center">
        <div className="text-4xl mb-4">🗄️</div>
        <h1 className="text-2xl font-black text-white mb-2">
          You&apos;re off the current roster
        </h1>
        <p className="text-sm text-zinc-400 mb-2">
          {currentUser.displayName} has been moved off the active crew, so the
          app is paused here.
        </p>
        <p className="text-sm text-zinc-500 mb-8">
          Nothing you logged is gone — your days, badges and posts are all still
          there. If this looks wrong, ask your Q to put you back on.
        </p>
        <button
          onClick={logout}
          className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors underline underline-offset-4"
        >
          Not you? Switch PAX
        </button>
      </div>
    </div>
  )
}
