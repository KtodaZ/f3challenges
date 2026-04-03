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
      <div className="fixed top-4 right-4 z-60 flex items-center gap-2 bg-amber-500/20 border border-amber-500/50 rounded-full px-3 py-1.5">
        <span className="text-amber-400 text-xs">⚠ Connection issue</span>
        <button onClick={() => window.location.reload()} className="text-xs text-amber-300 hover:text-white">Refresh</button>
      </div>
    )
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-60 bg-amber-500/95 text-amber-950 px-4 py-2 flex items-center justify-between text-sm">
      <span>⚠️ Ad blocker detected — please disable it for this page to use the app.</span>
      <div className="flex items-center gap-2">
        <button onClick={() => window.location.reload()} className="font-semibold underline">Refresh</button>
        <button onClick={() => setDismissed(true)} className="ml-2 font-bold text-lg leading-none">×</button>
      </div>
    </div>
  )
}
