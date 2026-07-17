'use client'

import { cn } from '@/lib/utils'

interface FeedImageGridProps {
  urls: string[]
  onOpen: (index: number) => void
}

/** One tappable image tile. */
function Tile({
  url,
  index,
  onOpen,
  className,
  overlayCount,
}: {
  url: string
  index: number
  onOpen: (index: number) => void
  className?: string
  overlayCount?: number
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      className={cn('relative overflow-hidden bg-zinc-800 group', className)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        loading="lazy"
        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
      />
      {overlayCount ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-white text-2xl font-bold">
          +{overlayCount}
        </div>
      ) : null}
    </button>
  )
}

/**
 * Adaptive photo grid for a feed post. Lays out 1–4 images in tuned
 * arrangements and collapses 5+ into a clean 2×2 with a "+N" overlay on the
 * last tile — every tile opens the full-screen lightbox.
 */
export function FeedImageGrid({ urls, onOpen }: FeedImageGridProps) {
  if (!urls.length) return null
  const n = urls.length

  // Single image — show its true aspect ratio (capped height).
  if (n === 1) {
    return (
      <div className="mt-3 rounded-xl overflow-hidden">
        <button type="button" onClick={() => onOpen(0)} className="block w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={urls[0]}
            alt=""
            loading="lazy"
            className="w-full max-h-[28rem] object-cover"
          />
        </button>
      </div>
    )
  }

  if (n === 2) {
    return (
      <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl overflow-hidden">
        {urls.map((url, i) => (
          <Tile key={i} url={url} index={i} onOpen={onOpen} className="aspect-square" />
        ))}
      </div>
    )
  }

  // Three — one wide hero on top, two square below.
  if (n === 3) {
    return (
      <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl overflow-hidden">
        <Tile url={urls[0]} index={0} onOpen={onOpen} className="col-span-2 aspect-[16/9]" />
        <Tile url={urls[1]} index={1} onOpen={onOpen} className="aspect-square" />
        <Tile url={urls[2]} index={2} onOpen={onOpen} className="aspect-square" />
      </div>
    )
  }

  // Four or more — 2×2, with "+N" overlay on the last visible tile.
  const visible = urls.slice(0, 4)
  const extra = n - 4
  return (
    <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl overflow-hidden">
      {visible.map((url, i) => (
        <Tile
          key={i}
          url={url}
          index={i}
          onOpen={onOpen}
          className="aspect-square"
          overlayCount={i === 3 && extra > 0 ? extra : undefined}
        />
      ))}
    </div>
  )
}
