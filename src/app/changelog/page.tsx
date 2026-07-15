'use client'

import Link from 'next/link'
import { Changelog } from '@/components/ui/Changelog'
import { getChangelog } from '@/lib/changelog'

export default function ChangelogPage() {
  const entries = getChangelog()

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
          <h1 className="text-xl font-bold text-white">What&apos;s New</h1>
          <p className="text-xs text-zinc-500">Recent updates to the app</p>
        </div>
      </div>

      <Changelog entries={entries} />
    </div>
  )
}
