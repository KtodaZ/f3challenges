'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface LightboxProps {
  urls: string[]
  index: number
  onClose: () => void
}

/**
 * Full-screen, swipeable image viewer. Tap the backdrop or the close button to
 * dismiss; swipe (touch) or use the arrows / arrow keys to move between images.
 */
export function Lightbox({ urls, index, onClose }: LightboxProps) {
  const [rawCurrent, setCurrent] = useState(index)
  const touchStartX = useRef<number | null>(null)

  // Clamp during render so a live edit that shrinks the list (via a feed
  // snapshot) can never make us read urls[out-of-bounds].
  const current = Math.min(rawCurrent, Math.max(0, urls.length - 1))

  const go = useCallback(
    (delta: number) => {
      setCurrent(() => Math.min(urls.length - 1, Math.max(0, current + delta)))
    },
    [urls.length, current]
  )

  // If a live edit removes every image, there's nothing to show — close.
  useEffect(() => {
    if (urls.length === 0) onClose()
  }, [urls.length, onClose])

  // Keyboard nav + lock body scroll while open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [go, onClose])

  const hasPrev = current > 0
  const hasNext = current < urls.length - 1

  if (urls.length === 0) return null

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center animate-in fade-in duration-150"
      onClick={onClose}
      onTouchStart={e => {
        touchStartX.current = e.touches[0].clientX
      }}
      onTouchEnd={e => {
        if (touchStartX.current === null) return
        const dx = e.changedTouches[0].clientX - touchStartX.current
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
        touchStartX.current = null
      }}
    >
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label="Close"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Counter */}
      {urls.length > 1 && (
        <span className="absolute top-6 left-1/2 -translate-x-1/2 text-sm text-white/80 tabular-nums">
          {current + 1} / {urls.length}
        </span>
      )}

      {/* Prev / Next (desktop) */}
      {hasPrev && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); go(-1) }}
          className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Previous image"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      {hasNext && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); go(1) }}
          className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Next image"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={urls[current]}
        alt=""
        onClick={e => e.stopPropagation()}
        className="max-w-[92vw] max-h-[88vh] object-contain select-none"
      />

      {/* Dots */}
      {urls.length > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-1.5">
          {urls.map((_, i) => (
            <span
              key={i}
              className={i === current ? 'w-2 h-2 rounded-full bg-white' : 'w-2 h-2 rounded-full bg-white/35'}
            />
          ))}
        </div>
      )}
    </div>
  )
}
