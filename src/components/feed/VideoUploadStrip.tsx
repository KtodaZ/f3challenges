'use client'

import { useRef } from 'react'
import { MAX_FEED_VIDEOS } from '@/lib/videos'
import type { FeedVideoItem } from '@/hooks/useFeedVideos'

interface VideoUploadStripProps {
  items: FeedVideoItem[]
  canAddMore: boolean
  disabled?: boolean
  onAdd: (files: FileList) => void
  onRemove: (id: string) => void
  onRetry: (id: string) => void
}

/** Circular upload-progress ring drawn over a thumbnail. */
function ProgressRing({ progress }: { progress: number }) {
  const r = 14
  const c = 2 * Math.PI * r
  return (
    <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        stroke="#f97316"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (c * progress) / 100}
        className="transition-[stroke-dashoffset] duration-200"
      />
    </svg>
  )
}

export function VideoUploadStrip({
  items,
  canAddMore,
  disabled,
  onAdd,
  onRemove,
  onRetry,
}: VideoUploadStripProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  if (items.length === 0 && !canAddMore) return null

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {items.map(item => (
        <div
          key={item.id}
          className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700"
        >
          {/* First frame as the thumbnail — muted + metadata preload keeps it light. */}
          <video
            src={item.previewUrl}
            muted
            playsInline
            preload="metadata"
            className="w-full h-full object-cover"
          />

          {/* Play badge (hidden while uploading/errored to avoid overlap) */}
          {item.status === 'done' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="w-7 h-7 flex items-center justify-center rounded-full bg-black/50">
                <svg className="w-3.5 h-3.5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </div>
          )}

          {/* Uploading overlay */}
          {item.status === 'uploading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <ProgressRing progress={item.progress} />
            </div>
          )}

          {/* Error overlay — tap to retry */}
          {item.status === 'error' && (
            <button
              type="button"
              onClick={() => onRetry(item.id)}
              className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-red-950/70 hover:bg-red-900/70 text-center px-1 transition-colors"
              aria-label="Retry upload"
            >
              <svg className="w-4 h-4 text-red-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-[10px] text-red-200 leading-tight font-medium">Retry</span>
            </button>
          )}

          {/* Remove */}
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
            aria-label="Remove video"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      {/* Add tile */}
      {canAddMore && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="w-20 h-20 shrink-0 rounded-xl border-2 border-dashed border-zinc-700 hover:border-orange-500 text-zinc-500 hover:text-orange-400 flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Add videos"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 8h8a2 2 0 012 2v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4a2 2 0 012-2z" />
          </svg>
          <span className="text-[10px] tabular-nums">
            {items.length}/{MAX_FEED_VIDEOS}
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={e => {
          if (e.target.files?.length) onAdd(e.target.files)
          e.target.value = '' // allow re-picking the same file
        }}
      />
    </div>
  )
}
