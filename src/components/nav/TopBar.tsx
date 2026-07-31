'use client'

import { usePathname } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { useRegion } from '@/contexts/RegionContext'
import { NotificationBell } from '@/components/notifications/NotificationBell'

const TITLES: Record<string, string> = {
  '/':            'Today',
  '/feed':        'Feed',
  '/leaderboard': 'Leaderboard',
  '/profile':     'Profile',
}

export function TopBar() {
  const pathname    = usePathname()
  const { currentUser } = useUser()
  const { region } = useRegion()

  // Hide on onboarding
  if (pathname.startsWith('/onboarding')) return null

  const title = TITLES[pathname]
    ?? (pathname.startsWith('/profile') ? 'Profile' : region.name)

  return (
    <header className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur-sm border-b border-zinc-800/60 safe-top">
      <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-orange-500 font-black text-lg leading-none">F3</span>
          <span className="text-white font-semibold text-base">{title}</span>
        </div>
        {currentUser && <NotificationBell userId={currentUser.id} />}
      </div>
    </header>
  )
}
