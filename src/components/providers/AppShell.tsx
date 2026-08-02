'use client'

import { usePathname } from 'next/navigation'
import { RegionProvider } from '@/contexts/RegionContext'
import { UserProvider } from '@/contexts/UserContext'
import { BottomNav } from '@/components/nav/BottomNav'
import { TopBar } from '@/components/nav/TopBar'
import { FCMInitializer } from '@/components/notifications/FCMInitializer'
import { FirestoreConnectionGuard } from '@/components/providers/FirestoreConnectionGuard'
import { UpdateChecker } from '@/components/providers/UpdateChecker'
import { PendingCelebrationHandler } from '@/components/providers/PendingCelebrationHandler'
import { ArchivedGate } from '@/components/providers/ArchivedGate'
import { ViewingAsBanner } from '@/components/providers/ViewingAsBanner'
import { AdminModeProvider } from '@/contexts/AdminModeContext'

/**
 * Keeps the PAX app out of the admin panel.
 *
 * The admin panel is a different application that happens to share a
 * deployment: admins authenticate with Google, PAX don't authenticate at all.
 * Mounting the PAX providers underneath it isn't just visual clutter — it
 * restores whatever trust-based session is in localStorage, opens a realtime
 * subscription to that region's roster, and lets `FCMInitializer` register a
 * push token against that PAX. Opening the admin panel should not sign you in
 * as somebody.
 *
 * This can't be solved with a route group. `app/layout.tsx` is the root layout
 * and wraps every route; separate root layouts require deleting it and moving
 * the whole app into a `(pax)` group, which trades this problem for a
 * structural refactor and full page loads between the two trees. A pathname
 * check is smaller and does the same job.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (pathname?.startsWith('/admin')) {
    return <>{children}</>
  }

  return (
    <RegionProvider>
      <UserProvider>
        <AdminModeProvider>
        <ArchivedGate>
          <FCMInitializer />
          <FirestoreConnectionGuard />
          <UpdateChecker />
          <PendingCelebrationHandler />
          <ViewingAsBanner />
          <TopBar />
          <main className="pb-nav min-h-dvh">
            {children}
          </main>
          <BottomNav />
        </ArchivedGate>
        </AdminModeProvider>
      </UserProvider>
    </RegionProvider>
  )
}
