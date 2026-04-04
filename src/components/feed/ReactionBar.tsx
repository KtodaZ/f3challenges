'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

export const REACTION_EMOJIS = ['🔥', '💪', '👏', '😂', '❤️']

interface ReactionBarProps {
  reactions?: Record<string, string[]>
  currentUserId: string | undefined
  onToggle: (emoji: string) => void
  size?: 'sm' | 'xs'
}

export function ReactionBar({ reactions = {}, currentUserId, onToggle, size = 'sm' }: ReactionBarProps) {
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

  // Only show emojis with at least one reactor
  const activeEntries = REACTION_EMOJIS
    .map(emoji => ({ emoji, users: reactions[emoji] ?? [] }))
    .filter(({ users }) => users.length > 0)

  const pillClass = size === 'xs'
    ? 'px-1.5 py-0.5 text-[10px] gap-0.5'
    : 'px-2 py-0.5 text-xs gap-1'

  const addBtnClass = size === 'xs'
    ? 'w-5 h-5 text-[10px]'
    : 'w-6 h-6 text-xs'

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {activeEntries.map(({ emoji, users }) => {
        const hasReacted = currentUserId ? users.includes(currentUserId) : false
        return (
          <button
            key={emoji}
            onClick={() => onToggle(emoji)}
            className={cn(
              'flex items-center rounded-full border transition-colors',
              pillClass,
              hasReacted
                ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
            )}
          >
            <span>{emoji}</span>
            <span className="tabular-nums">{users.length}</span>
          </button>
        )
      })}

      {/* Add reaction */}
      <div ref={pickerRef} className="relative">
        <button
          onClick={() => setPickerOpen(v => !v)}
          className={cn(
            'flex items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300 transition-colors',
            addBtnClass
          )}
          aria-label="Add reaction"
        >
          +
        </button>

        {pickerOpen && (
          <div className="absolute bottom-full mb-1.5 left-0 flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 rounded-full px-2.5 py-1.5 shadow-xl z-20">
            {REACTION_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => { onToggle(emoji); setPickerOpen(false) }}
                className="text-base leading-none hover:scale-125 transition-transform active:scale-110"
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
