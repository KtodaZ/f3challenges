'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'

export default function SettingsPage() {
  const { currentUser, loading, logout } = useUser()
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

  function handleSwitchUser() {
    logout()
    router.push('/onboarding')
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 pb-nav">
      <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
      <p className="text-sm text-zinc-500 mb-6">Signed in as {currentUser.displayName}</p>

      <div className="space-y-3">
        {/* Notifications */}
        <Link
          href="/settings/notifications"
          className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 hover:border-zinc-700 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-500/20 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Notification Preferences</p>
              <p className="text-xs text-zinc-500">Reminders, recaps, and mentions</p>
            </div>
          </div>
          <svg className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        {/* Switch user */}
        <button
          onClick={handleSwitchUser}
          className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 hover:border-zinc-700 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-zinc-800 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-white">Switch User</p>
              <p className="text-xs text-zinc-500">Log out and choose a different F3 name</p>
            </div>
          </div>
          <svg className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* App info */}
      <div className="mt-10 text-center space-y-1">
        <p className="text-xs text-zinc-600 font-medium tracking-wide uppercase">F3 Bedrock Monthly Challenge</p>
        <p className="text-xs text-zinc-700">v1.0.0 · Built with grit &amp; grace</p>
      </div>
    </div>
  )
}
