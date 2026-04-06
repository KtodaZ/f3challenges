'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { useUser } from '@/contexts/UserContext'

export const REACTION_EMOJIS = ['🔥', '💪', '😍', '😆', '😮']

type Particle = { id: number; emoji: string; x: number; y: number; dx: number }

interface ReactionBarProps {
  reactions?: Record<string, string[]>
  currentUserId: string | undefined
  onToggle: (emoji: string) => void
}

export function ReactionBar({ reactions = {}, currentUserId, onToggle }: ReactionBarProps) {
  const { allUsers } = useUser()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [openPopover, setOpenPopover] = useState<string | null>(null)
  const [particles, setParticles] = useState<Particle[]>([])
  const [poppedEmoji, setPoppedEmoji] = useState<string | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const nextId = useRef(0)

  useEffect(() => {
    if (!pickerOpen && !openPopover) return
    function handler(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpenPopover(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerOpen, openPopover])

  function spawnParticles(emoji: string, originX: number, originY: number) {
    const spreads = [-44, -22, 0, 22, 44, 8, -10]
    const newParticles = spreads.map(dx => ({
      id: nextId.current++,
      emoji,
      x: originX,
      y: originY,
      dx,
    }))
    setParticles(prev => [...prev, ...newParticles])
    setTimeout(() => {
      const ids = new Set(newParticles.map(p => p.id))
      setParticles(prev => prev.filter(p => !ids.has(p.id)))
    }, 750)
  }

  function handlePickerEmoji(emoji: string, e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    onToggle(emoji)
    setPickerOpen(false)
    spawnParticles(emoji, rect.left + rect.width / 2, rect.top)
    setPoppedEmoji(emoji)
    setTimeout(() => setPoppedEmoji(null), 400)
  }

  const activeEntries = REACTION_EMOJIS
    .map(emoji => ({ emoji, users: reactions[emoji] ?? [] }))
    .filter(({ users }) => users.length > 0)

  function getDisplayName(userId: string) {
    return allUsers.find(u => u.id === userId)?.displayName ?? userId
  }

  return (
    <div className="inline-flex items-center gap-2.5">
      {activeEntries.map(({ emoji, users }) => {
        const hasReacted = currentUserId ? users.includes(currentUserId) : false
        const isOpen = openPopover === emoji
        return (
          <div key={emoji} className="relative">
            <button
              onClick={() => setOpenPopover(isOpen ? null : emoji)}
              style={poppedEmoji === emoji ? { animation: 'chip-pop 0.35s ease-out' } : undefined}
              className={cn(
                'flex items-center gap-0.5 transition-colors',
                hasReacted ? 'text-orange-400' : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <span className="text-sm leading-none">{emoji}</span>
              <span className="text-[11px] tabular-nums">{users.length}</span>
            </button>

            {isOpen && (
              <div
                ref={popoverRef}
                className="absolute bottom-full mb-2 left-0 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 shadow-xl z-20 min-w-max"
              >
                <p className="text-[10px] text-zinc-500 mb-1">{emoji} reacted</p>
                <ul className="flex flex-col gap-0.5">
                  {users.map(uid => (
                    <li key={uid} className={cn('text-xs', uid === currentUserId ? 'text-orange-400' : 'text-zinc-200')}>
                      {getDisplayName(uid)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )
      })}

      {/* Add reaction — smiley icon */}
      <div ref={pickerRef} className="relative flex items-center h-4">
        <button
          onClick={() => setPickerOpen(v => !v)}
          className="inline-flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
          aria-label="Add reaction"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="8" />
            <path strokeLinecap="round" d="M9 13.5s1 1.5 3 1.5 3-1.5 3-1.5" />
            <circle cx="9.5" cy="10" r="1" fill="currentColor" stroke="none" />
            <circle cx="14.5" cy="10" r="1" fill="currentColor" stroke="none" />
          </svg>
        </button>

        {pickerOpen && (
          <div className="absolute bottom-full mb-2 left-0 flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-full px-3 py-2 shadow-xl z-20">
            {REACTION_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={e => handlePickerEmoji(emoji, e)}
                className="text-lg leading-none hover:scale-125 transition-transform active:scale-110"
                aria-label={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Burst particles rendered into document body */}
      {typeof document !== 'undefined' && particles.length > 0 && createPortal(
        particles.map(p => (
          <span
            key={p.id}
            style={{
              position: 'fixed',
              left: p.x,
              top: p.y,
              '--burst-dx': `${p.dx}px`,
              animation: 'emoji-burst 0.72s ease-out forwards',
              pointerEvents: 'none',
              fontSize: '1.3rem',
              lineHeight: 1,
              zIndex: 9999,
              userSelect: 'none',
            } as React.CSSProperties}
          >
            {p.emoji}
          </span>
        )),
        document.body
      )}
    </div>
  )
}
