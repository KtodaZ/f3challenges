'use client'

interface FeedVideoGridProps {
  urls: string[]
}

/**
 * Renders attached videos on a feed post as inline players. Videos stay in a
 * single column (unlike the photo grid) so each keeps its native aspect ratio
 * and native controls stay comfortably tappable. `preload="metadata"` avoids
 * pulling full files until a PAX actually hits play.
 */
export function FeedVideoGrid({ urls }: FeedVideoGridProps) {
  if (!urls.length) return null

  return (
    <div className="mt-3 flex flex-col gap-2">
      {urls.map((url, i) => (
        <div key={i} className="rounded-xl overflow-hidden bg-black">
          <video
            src={url}
            controls
            playsInline
            preload="metadata"
            className="w-full max-h-[28rem] object-contain bg-black"
          />
        </div>
      ))}
    </div>
  )
}
