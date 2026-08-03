'use client'

import { useRegion } from '@/contexts/RegionContext'

/**
 * Persistent reminder that the app on screen belongs to a region you're only
 * previewing, and what you may do there.
 *
 * Deliberately loud and always visible. The whole point of the preview is that
 * the app looks exactly as that region's PAX see it — which means there is no
 * other cue that you're not in your own region, and a Q who forgets could
 * spend a while confused about why their logging isn't working.
 *
 * The two states say different things because they allow different things: a
 * superadmin can post and comment here, anyone else is only reading.
 */
export function ViewingAsBanner() {
  const { viewingAs, region, setViewingAs, socialReadOnly } = useRegion()
  if (!viewingAs) return null

  return (
    <div className="sticky top-0 z-40 bg-amber-500/15 border-b border-amber-500/30 px-4 py-2">
      <div className="max-w-2xl mx-auto flex items-center gap-3">
        <p className="flex-1 text-xs text-amber-200 leading-snug">
          Viewing <span className="font-semibold">{region.name}</span> as an admin —{' '}
          {socialReadOnly
            ? 'read only. Nothing you do here can be logged.'
            : "you can post, comment and react here. Logging is off — your reps count in your own region."}
        </p>
        <button
          onClick={() => setViewingAs(null)}
          className="shrink-0 text-xs font-semibold text-amber-200 hover:text-amber-100 underline underline-offset-4"
        >
          Back to my region
        </button>
      </div>
    </div>
  )
}
