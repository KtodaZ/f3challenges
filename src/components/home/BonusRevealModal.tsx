'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn, formatDate } from '@/lib/utils'
import type { BonusChallenge, BonusChallengeWeek } from '@/types'

interface BonusRevealModalProps {
  bonus: BonusChallenge
  activeWeek: BonusChallengeWeek
  onClose: () => void
}

export function BonusRevealModal({ bonus, activeWeek, onClose }: BonusRevealModalProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-0 bg-zinc-950/90 transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
      />

      <div
        className={cn(
          'relative z-10 text-center max-w-sm w-full transition-all duration-300 ease-out',
          visible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
        )}
        onClick={e => e.stopPropagation()}
      >
        <div className="text-7xl mb-4" role="img" aria-label="star">⭐</div>

        <p className="text-blue-400 text-xs font-semibold uppercase tracking-widest mb-1">
          Bonus Challenge Revealed
        </p>
        <h2 className="text-3xl font-black text-white uppercase tracking-tight leading-tight mb-2">
          {bonus.name}
        </h2>

        <div className="bg-blue-950/60 border border-blue-700/50 rounded-2xl px-5 py-5 mb-3">
          <p className="text-white text-base font-semibold leading-snug mb-2">
            {activeWeek.description}
          </p>
          <p className="text-zinc-400 text-xs">
            {formatDate(activeWeek.startDate)} – {formatDate(activeWeek.endDate)}
          </p>
          <p className="text-zinc-500 text-xs mt-0.5">Complete once this week</p>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black text-lg py-4 rounded-2xl transition-colors mt-1"
        >
          Let&apos;s Go! 💪
        </button>
      </div>
    </div>,
    document.body
  )
}
