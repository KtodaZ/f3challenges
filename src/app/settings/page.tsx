'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FeedbackModal } from '@/components/settings/FeedbackModal'
import { useUser } from '@/contexts/UserContext'
import { useRegion } from '@/contexts/RegionContext'
import { useAdminMode } from '@/contexts/AdminModeContext'
import { REGIONS } from '@/lib/challenges'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  const { currentUser, loading, logout } = useUser()
  const { isAdmin, role } = useAdminMode()
  const { regionId, viewingAs, setViewingAs } = useRegion()
  const router = useRouter()
  const [feedbackOpen, setFeedbackOpen] = useState(false)

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

        {/* App install troubleshoot */}
        <Link
          href="/settings/notifications/troubleshoot"
          className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 hover:border-zinc-700 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-zinc-800 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l5.654-4.654m5.546-4.087c.319-.379.548-.82.657-1.302a4.5 4.5 0 00-6.364-4.73" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-white">App Install Troubleshooting</p>
              <p className="text-xs text-zinc-500">Fix app install and notification setup</p>
            </div>
          </div>
          <svg className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        {/* Past challenges */}
        <Link
          href="/settings/past-challenges"
          className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 hover:border-zinc-700 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500/20 rounded-xl flex items-center justify-center shrink-0">
              <span className="text-lg">🏆</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Past Challenges</p>
              <p className="text-xs text-zinc-500">Update your badges for previous challenges</p>
            </div>
          </div>
          <svg className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        {/* Feedback / bug report */}
        <button
          onClick={() => setFeedbackOpen(true)}
          className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 hover:border-zinc-700 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-sky-500/20 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10.5h8m-8 4h5m5.25 6.25l-3.5-3.5H6.75A2.25 2.25 0 014.5 15V6.75A2.25 2.25 0 016.75 4.5h10.5a2.25 2.25 0 012.25 2.25V15a2.25 2.25 0 01-2.25 2.25h-.5v3.5z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-white">Send Feedback</p>
              <p className="text-xs text-zinc-500">Report a bug or suggest something</p>
            </div>
          </div>
          <svg className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

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

      {/* Superadmin only: see another region's app exactly as its PAX do.
          Region admins are excluded — running Sactown is no reason to browse
          Bedrock. */}
      {role === 'superadmin' && (
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-sm font-medium text-white mb-1">View another region</p>
          <p className="text-xs text-zinc-500 mb-3">
            Loads that region&apos;s challenge, leaderboard and feed as its PAX see them.
            You can post, comment and react in their feed — your posts show an Admin tag.
            Logging stays off: your reps only count in your own region.
          </p>
          <div className="flex flex-wrap gap-2">
            {REGIONS.map(r => {
              const active = viewingAs === r.id
              const isOwn = !viewingAs && r.id === regionId
              return (
                <button
                  key={r.id}
                  onClick={() => setViewingAs(active || isOwn ? null : r.id)}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-lg border transition-colors',
                    active
                      ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
                      : isOwn
                        ? 'border-zinc-700 bg-zinc-800 text-zinc-300'
                        : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                  )}
                >
                  {r.shortName}
                  {isOwn && ' (yours)'}
                  {active && ' — viewing'}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* App info */}
      <div className="mt-10 text-center space-y-1">
        <p className="text-xs text-zinc-600 font-medium tracking-wide uppercase">F3 Norcal Monthly Challenge</p>
        <Link href="/changelog" className="inline-block text-xs text-zinc-700 hover:text-zinc-500 transition-colors">
          v1.0.0 · What&apos;s new
        </Link>
        {isAdmin && (
          <div>
            <Link
              href="/admin"
              className="inline-block text-xs text-zinc-700 hover:text-zinc-500 transition-colors"
            >
              Admin panel
            </Link>
          </div>
        )}
      </div>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  )
}
