'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { ChallengeTemplate } from '@/types'
import { getRequiredDays } from '@/lib/challenges'

const CONFETTI_COLORS = [
  '#f59e0b', '#ef4444', '#3b82f6', '#22c55e',
  '#a855f7', '#ec4899', '#06b6d4', '#fbbf24', '#f97316',
]

function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      if (!canvasRef.current) return
      canvasRef.current.width = window.innerWidth
      canvasRef.current.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const particles = Array.from({ length: 90 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * -window.innerHeight * 0.6,
      vx: (Math.random() - 0.5) * 4,
      vy: 3 + Math.random() * 5,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      w: 8 + Math.random() * 9,
      h: 4 + Math.random() * 5,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.28,
    }))

    let animId: number
    const draw = () => {
      const c = canvasRef.current
      const g = c?.getContext('2d')
      if (!c || !g) return
      g.clearRect(0, 0, c.width, c.height)
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        p.angle += p.spin
        if (p.y > c.height + 20) {
          p.y = -20
          p.x = Math.random() * c.width
        }
        g.save()
        g.translate(p.x, p.y)
        g.rotate(p.angle)
        g.fillStyle = p.color
        g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        g.restore()
      }
      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
}

interface CelebrationModalProps {
  challenge: ChallengeTemplate
  onClose: () => void
}

export function CelebrationModal({ challenge, onClose }: CelebrationModalProps) {
  const days = getRequiredDays(challenge)

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-zinc-950/96"
        onClick={onClose}
      />
      <ConfettiCanvas />

      <div
        className="relative z-10 text-center px-8 max-w-sm w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-8xl mb-5" role="img" aria-label="trophy">🏆</div>

        <h1 className="text-4xl font-black text-white uppercase tracking-tight mb-1 leading-none">
          Challenge<br />Complete!
        </h1>

        <p className="text-orange-400 font-bold text-xl mt-3 mb-1">{challenge.name}</p>
        <p className="text-zinc-400 text-sm mb-8">
          {days} days &mdash; every single one
        </p>

        <div className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-5 mb-8">
          <div className="text-4xl mb-2">🏅</div>
          <p className="text-amber-400 font-bold text-base">Completion Badge Earned</p>
          <p className="text-zinc-400 text-xs mt-1">{challenge.hashtag}</p>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-orange-500 hover:bg-orange-400 active:bg-orange-600 text-white font-black text-xl py-4 rounded-2xl transition-colors"
        >
          LET&apos;S GO! 💪
        </button>
      </div>
    </div>,
    document.body
  )
}
