'use client'

import { useRef } from 'react'
import { MAX_FEED_IMAGES } from '@/lib/images'
import type { FeedImageItem } from '@/hooks/useFeedImages'

interface ImageUploadStripProps {
  items: FeedImageItem[]
  canAddMore: boolean
  disabled?: boolean
  onAdd: (files: FileList) => void
  onRemove: (id: string) => void
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

export function ImageUploadStrip({
  items,
  canAddMore,
  disabled,
  onAdd,
  onRemove,
}: ImageUploadStripProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  if (items.length === 0 && !canAddMore) return null

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {items.map(item => (
        <div
          key={item.id}
          className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />

          {/* Uploading overlay */}
          {item.status === 'uploading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <ProgressRing progress={item.progress} />
            </div>
          )}

          {/* Error overlay */}
          {item.status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-red-950/70 text-center px-1">
              <span className="text-red-300 text-lg leading-none">⚠</span>
              <span className="text-[10px] text-red-200 leading-tight">Failed</span>
            </div>
          )}

          {/* Remove */}
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
            aria-label="Remove image"
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
          aria-label="Add photos"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-[10px] tabular-nums">
            {items.length}/{MAX_FEED_IMAGES}
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
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
