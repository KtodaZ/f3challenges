'use client'

import { useState } from 'react'
import { Changelog } from '@/components/ui/Changelog'
import { getRecentChangelog } from '@/lib/changelog'

interface UpdateBannerProps {
  visible: boolean
}

export function UpdateBanner({ visible }: UpdateBannerProps) {
  const [showChanges, setShowChanges] = useState(false)

  if (!visible) return null

  const recent = getRecentChangelog()

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-6">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-8 w-full max-w-sm text-center shadow-2xl">
        <div className="text-4xl mb-4">🔄</div>
        <h2 className="text-xl font-bold text-zinc-100 mb-2">Update Available</h2>
        <p className="text-zinc-400 text-sm mb-6">A new version of the app is ready. Reload to get the latest.</p>

        {recent.length > 0 && (
          <div className="mb-6">
            <button
              onClick={() => setShowChanges(v => !v)}
              className="text-sm font-medium text-orange-400 hover:text-orange-300 transition-colors inline-flex items-center gap-1"
              aria-expanded={showChanges}
            >
              What&apos;s new
              <svg
                className={`w-4 h-4 transition-transform ${showChanges ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showChanges && (
              <div className="mt-4 text-left max-h-60 overflow-y-auto">
                <Changelog entries={recent} />
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => window.location.reload()}
          className="w-full bg-zinc-100 text-zinc-900 font-semibold py-3 rounded-xl text-sm hover:bg-white transition-colors"
        >
          Reload Now
        </button>
      </div>
    </div>
  )
}
