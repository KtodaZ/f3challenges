'use client'

import { useEffect, useState } from 'react'
import { subscribeToNotifications } from '@/lib/firestore'
import type { AppNotification } from '@/types'
import { NotificationDrawer } from './NotificationDrawer'

interface NotificationBellProps {
  userId: string
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    const unsubscribe = subscribeToNotifications(userId, setNotifications)
    return unsubscribe
  }, [userId])

  useEffect(() => {
    const handler = () => setDrawerOpen(true)
    window.addEventListener('fcm-foreground-message', handler)
    return () => window.removeEventListener('fcm-foreground-message', handler)
  }, [])

  const unreadCount = notifications.length
  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount)

  return (
    <>
      <button
        type="button"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        onClick={() => setDrawerOpen(true)}
        className="relative p-2 text-zinc-400 hover:text-white transition-colors rounded-full hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>

        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-orange-500 text-white text-[10px] font-bold leading-none px-[3px]"
          >
            {badgeLabel}
          </span>
        )}
      </button>

      <NotificationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        notifications={notifications}
        userId={userId}
      />
    </>
  )
}
