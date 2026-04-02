'use client'

import { useState } from 'react'

interface FirestoreErrorBannerProps {
  visible: boolean
}

export function FirestoreErrorBanner({ visible }: FirestoreErrorBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (!visible) return null

  if (dismissed) {
    return (
      <div className="fixed top-4 right-4 z-50 flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-medium text-amber-950 shadow-lg">
        <span aria-hidden="true">⚠</span>
        <span>Connection issue</span>
      </div>
    )
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-start gap-3 bg-amber-400 px-4 py-3 text-amber-950 shadow-md">
      <span className="mt-0.5 shrink-0 text-lg" aria-hidden="true">⚠️</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold leading-tight">Connection blocked</p>
        <p className="mt-0.5 text-sm leading-snug">
          Your ad blocker is preventing the app from connecting. Please disable it for this page, then refresh.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={() => window.location.reload()}
          className="rounded bg-amber-950 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-950"
        >
          Refresh
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss banner"
          className="rounded p-1 hover:bg-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-950"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
