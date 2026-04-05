'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { markNotificationRead } from '@/lib/firestore'
import { timeAgo, cn } from '@/lib/utils'
import type { AppNotification, NotificationType } from '@/types'

interface NotificationDrawerProps {
  open: boolean
  onClose: () => void
  notifications: AppNotification[]
  userId: string
}

const TYPE_ICON: Record<NotificationType, string> = {
  mention:          '💬',
  shoutout:         '💪',
  comment:          '💬',
  reply:            '↩️',
  daily_reminder:   '⏰',
  weekly_recap:     '📊',
  system:           '📢',
}

export function NotificationDrawer({
  open,
  onClose,
  notifications,
  userId,
}: NotificationDrawerProps) {
  const router = useRouter()
  const drawerRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef<number | null>(null)
  const dragOffset = useRef(0)

  // Keep the drawer in the DOM during the exit animation, then unmount.
  const [rendered, setRendered] = useState(open)
  // Separate state drives the CSS open/closed classes (lags one frame behind `open` on mount).
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRendered(true)
      // One frame later so the enter transition fires properly.
      const raf = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(raf)
    } else {
      setVisible(false)
      const t = setTimeout(() => setRendered(false), 300)
      return () => clearTimeout(t)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  function handleDragStart(e: React.TouchEvent) {
    dragStartY.current = e.touches[0].clientY
    dragOffset.current = 0
    if (drawerRef.current) drawerRef.current.style.transition = 'none'
  }

  function handleDragMove(e: React.TouchEvent) {
    if (dragStartY.current === null) return
    const delta = Math.max(0, e.touches[0].clientY - dragStartY.current)
    dragOffset.current = delta
    if (drawerRef.current) drawerRef.current.style.transform = `translateY(${delta}px)`
  }

  function handleDragEnd() {
    if (dragStartY.current === null) return
    dragStartY.current = null
    if (drawerRef.current) drawerRef.current.style.transition = ''
    if (dragOffset.current > 120) {
      onClose()
    } else {
      if (drawerRef.current) drawerRef.current.style.transform = ''
    }
    dragOffset.current = 0
  }

  const handleMarkAllRead = async () => {
    await Promise.all(
      notifications.map(n => markNotificationRead(userId, n.id))
    )
  }

  const handleNotificationTap = async (notification: AppNotification) => {
    await markNotificationRead(userId, notification.id)

    if (notification.relatedPostId) {
      router.push('/feed')
      onClose()
    } else if (notification.relatedUserId) {
      router.push(`/profile/${notification.relatedUserId}`)
      onClose()
    }
  }

  if (!rendered) return null

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          'fixed inset-0 bg-black/60 z-50 transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        className={cn(
          'fixed bottom-0 left-0 right-0',
          'sm:right-0 sm:top-0 sm:left-auto sm:w-80',
          'bg-zinc-900 border-t sm:border-t-0 sm:border-l border-zinc-800',
          'z-50 flex flex-col',
          'max-h-[80dvh] sm:max-h-full sm:h-full',
          'transition-transform duration-300 ease-in-out',
          visible
            ? 'translate-y-0 sm:translate-x-0'
            : 'translate-y-full sm:translate-y-0 sm:translate-x-full',
        )}
      >
        {/* Drag handle (mobile only) */}
        <div
          className="flex justify-center pt-3 pb-2 sm:hidden cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
        >
          <div className="w-10 h-1.5 rounded-full bg-zinc-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <h2 className="text-base font-semibold text-white">Notifications</h2>
          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs text-orange-400 hover:text-orange-300 transition-colors font-medium"
              >
                Mark all read
              </button>
            )}
            <button
              type="button"
              aria-label="Close notifications"
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white transition-colors rounded-md hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Notification list */}
        <div className="overflow-y-auto flex-1">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <span className="text-3xl mb-3" aria-hidden="true">🎉</span>
              <p className="text-zinc-400 text-sm font-medium">You&apos;re all caught up</p>
            </div>
          ) : (
            <ul>
              {notifications.map(notification => (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => handleNotificationTap(notification)}
                    className={cn(
                      'relative w-full text-left flex items-start gap-3 px-4 py-3 min-h-[60px]',
                      'border-b border-zinc-800 last:border-b-0',
                      'transition-colors',
                      notification.read
                        ? 'bg-zinc-900 hover:bg-zinc-800/60'
                        : 'bg-zinc-800 hover:bg-zinc-700/60'
                    )}
                  >
                    {/* Unread indicator */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-orange-500 transition-opacity',
                        notification.read ? 'opacity-0' : 'opacity-100'
                      )}
                    />

                    {/* Icon */}
                    <span className="text-xl shrink-0 mt-0.5" aria-hidden="true">
                      {TYPE_ICON[notification.type]}
                    </span>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm leading-snug truncate',
                        notification.read ? 'text-zinc-300 font-normal' : 'text-white font-semibold'
                      )}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2 leading-snug">
                        {notification.body}
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-1">
                        {timeAgo(notification.createdAt)}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>,
    document.body
  )
}
