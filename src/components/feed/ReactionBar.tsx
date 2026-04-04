'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

export const REACTION_EMOJIS = ['🔥', '💪', '👏', '😂', '❤️']

interface ReactionBarProps {
  reactions?: Record<string, string[]>
  currentUserId: string | undefined
  onToggle: (emoji: string) => void
}

export function ReactionBar({ reactions = {}, currentUserId, onToggle }: ReactionBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pickerOpen) return
    function handler(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerOpen])

  const activeEntries = REACTION_EMOJIS
    .map(emoji => ({ emoji, users: reactions[emoji] ?? [] }))
    .filter(({ users }) => users.length > 0)

  return (
    <div className="inline-flex items-center gap-2.5">
      {activeEntries.map(({ emoji, users }) => {
        const hasReacted = currentUserId ? users.includes(currentUserId) : false
        return (
          <button
            key={emoji}
            onClick={() => onToggle(emoji)}
            className={cn(
              'flex items-center gap-0.5 transition-colors',
              hasReacted ? 'text-orange-400' : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <span className="text-sm leading-none">{emoji}</span>
            <span className="text-[11px] tabular-nums">{users.length}</span>
          </button>
        )
      })}

      {/* Add reaction — smiley icon */}
      <div ref={pickerRef} className="relative">
        <button
          onClick={() => setPickerOpen(v => !v)}
          className="inline-flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
          aria-label="Add reaction"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" d="M8 13.5s1.5 2 4 2 4-2 4-2" />
            <circle cx="9" cy="9.5" r="1" fill="currentColor" stroke="none" />
            <circle cx="15" cy="9.5" r="1" fill="currentColor" stroke="none" />
          </svg>
        </button>

        {pickerOpen && (
          <div className="absolute bottom-full mb-2 left-0 flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-full px-3 py-2 shadow-xl z-20">
            {REACTION_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => { onToggle(emoji); setPickerOpen(false) }}
                className="text-lg leading-none hover:scale-125 transition-transform active:scale-110"
                aria-label={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
