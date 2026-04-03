'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'
import { NotificationSettings } from '@/components/settings/NotificationSettings'

export default function NotificationsPage() {
  const { currentUser, loading } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !currentUser) router.replace('/onboarding')
  }, [currentUser, loading, router])

  if (loading || !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 pb-nav">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/settings"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          aria-label="Back to Settings"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Notifications</h1>
          <p className="text-xs text-zinc-500">Choose when and how we reach you</p>
        </div>
      </div>

      <NotificationSettings />
    </div>
  )
}
