'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import type { CelebrationTheme } from '@/types'

// ─── Particle canvas ──────────────────────────────────────────────────────────
// Four themes:
//   confetti  — multicolor falling rects (party)
//   gold      — gold/amber falling rects, slower (badge unlocks)
//   embers    — orange sparks rising from the bottom (redemption / comeback)
//   fireworks — radial bursts (milestones, perfect month)

const CONFETTI_COLORS = [
  '#f59e0b', '#ef4444', '#3b82f6', '#22c55e',
  '#a855f7', '#ec4899', '#06b6d4', '#fbbf24', '#f97316',
]
const GOLD_COLORS = ['#fbbf24', '#f59e0b', '#fde68a', '#d97706', '#fff7ed']
const EMBER_COLORS = ['#f97316', '#fb923c', '#f59e0b', '#ef4444', '#fbbf24']

interface Particle {
  x: number; y: number
  vx: number; vy: number
  color: string
  w: number; h: number
  angle: number; spin: number
  alpha: number; decay: number
  round?: boolean
}

function spawnFalling(colors: string[], slow: boolean): Particle {
  return {
    x: Math.random() * window.innerWidth,
    y: Math.random() * -window.innerHeight * 0.6,
    vx: (Math.random() - 0.5) * (slow ? 2.5 : 4),
    vy: (slow ? 2 : 3) + Math.random() * (slow ? 3.5 : 5),
    color: colors[Math.floor(Math.random() * colors.length)],
    w: 8 + Math.random() * 9,
    h: 4 + Math.random() * 5,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.28,
    alpha: 1, decay: 0,
  }
}

function spawnEmber(): Particle {
  const size = 2 + Math.random() * 4
  return {
    x: Math.random() * window.innerWidth,
    y: window.innerHeight + 10,
    vx: (Math.random() - 0.5) * 1.2,
    vy: -(1.5 + Math.random() * 3.5),
    color: EMBER_COLORS[Math.floor(Math.random() * EMBER_COLORS.length)],
    w: size, h: size,
    angle: 0, spin: 0,
    alpha: 1,
    decay: 0.003 + Math.random() * 0.006,
    round: true,
  }
}

function spawnBurst(particles: Particle[]) {
  const cx = window.innerWidth * (0.2 + Math.random() * 0.6)
  const cy = window.innerHeight * (0.15 + Math.random() * 0.4)
  const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]
  const n = 36 + Math.floor(Math.random() * 16)
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.2
    const speed = 2 + Math.random() * 5
    const size = 2.5 + Math.random() * 3
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      color,
      w: size, h: size,
      angle: 0, spin: 0,
      alpha: 1,
      decay: 0.012 + Math.random() * 0.012,
      round: true,
    })
  }
}

export function ParticleCanvas({ theme }: { theme: CelebrationTheme }) {
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

    let particles: Particle[] = []
    if (theme === 'confetti' || theme === 'gold') {
      const colors = theme === 'gold' ? GOLD_COLORS : CONFETTI_COLORS
      particles = Array.from({ length: 90 }, () => spawnFalling(colors, theme === 'gold'))
    } else if (theme === 'embers') {
      particles = Array.from({ length: 40 }, spawnEmber)
    }

    let burstTimer: ReturnType<typeof setInterval> | undefined
    if (theme === 'fireworks') {
      spawnBurst(particles)
      spawnBurst(particles)
      burstTimer = setInterval(() => {
        if (particles.length < 400) spawnBurst(particles)
      }, 750)
    }
    let emberTimer: ReturnType<typeof setInterval> | undefined
    if (theme === 'embers') {
      emberTimer = setInterval(() => {
        if (particles.length < 160) {
          particles.push(spawnEmber(), spawnEmber(), spawnEmber())
        }
      }, 180)
    }

    let animId: number
    const draw = () => {
      const c = canvasRef.current
      const g = c?.getContext('2d')
      if (!c || !g) return
      g.clearRect(0, 0, c.width, c.height)
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        p.angle += p.spin
        if (theme === 'fireworks') p.vy += 0.05 // gravity on burst sparks
        if (p.decay > 0) {
          p.alpha -= p.decay
          if (p.alpha <= 0) { particles.splice(i, 1); continue }
        }
        if ((theme === 'confetti' || theme === 'gold') && p.y > c.height + 20) {
          p.y = -20
          p.x = Math.random() * c.width
        }
        g.save()
        g.globalAlpha = Math.max(0, p.alpha)
        g.translate(p.x, p.y)
        g.rotate(p.angle)
        g.fillStyle = p.color
        if (p.round) {
          g.beginPath()
          g.arc(0, 0, p.w / 2, 0, Math.PI * 2)
          g.fill()
        } else {
          g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        }
        g.restore()
      }
      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(animId)
      if (burstTimer) clearInterval(burstTimer)
      if (emberTimer) clearInterval(emberTimer)
      window.removeEventListener('resize', resize)
    }
  }, [theme])

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
}

// ─── Generic full-screen celebration ─────────────────────────────────────────

export interface CelebrationContent {
  theme: CelebrationTheme
  emoji: string
  /** Small uppercase label above the title, e.g. "Achievement Unlocked" */
  kicker?: string
  /** Big headline. Use \n for a manual line break. */
  title: string
  subtitle?: string
  /** Optional highlighted card between subtitle and button. */
  detail?: { emoji?: string; title: string; caption?: string }
  buttonLabel?: string
}

interface CelebrationOverlayProps extends CelebrationContent {
  onClose: () => void
}

const KICKER_COLOR: Record<CelebrationTheme, string> = {
  confetti: 'text-orange-400',
  gold: 'text-amber-400',
  embers: 'text-orange-400',
  fireworks: 'text-sky-400',
}

const DETAIL_STYLE: Record<CelebrationTheme, string> = {
  confetti: 'bg-orange-500/10 border-orange-500/40',
  gold: 'bg-amber-500/15 border-amber-500/40',
  embers: 'bg-orange-950/60 border-orange-700/50',
  fireworks: 'bg-sky-950/60 border-sky-700/50',
}

export function CelebrationOverlay({
  theme, emoji, kicker, title, subtitle, detail, buttonLabel = "LET'S GO! 💪", onClose,
}: CelebrationOverlayProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-0 bg-zinc-950/96 transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
      />
      <ParticleCanvas theme={theme} />

      <div
        className={cn(
          'relative z-10 text-center px-8 max-w-sm w-full transition-all duration-300 ease-out',
          visible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
        )}
        onClick={e => e.stopPropagation()}
      >
        <div className="text-8xl mb-5">{emoji}</div>

        {kicker && (
          <p className={cn('text-xs font-semibold uppercase tracking-widest mb-2', KICKER_COLOR[theme])}>
            {kicker}
          </p>
        )}

        <h1 className="text-4xl font-black text-white uppercase tracking-tight mb-1 leading-none whitespace-pre-line">
          {title}
        </h1>

        {subtitle && (
          <p className="text-zinc-400 text-sm mt-3 mb-2">{subtitle}</p>
        )}

        {detail && (
          <div className={cn('border rounded-2xl p-5 mt-5 mb-2', DETAIL_STYLE[theme])}>
            {detail.emoji && <div className="text-4xl mb-2">{detail.emoji}</div>}
            <p className="text-white font-bold text-base">{detail.title}</p>
            {detail.caption && <p className="text-zinc-400 text-xs mt-1">{detail.caption}</p>}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full bg-orange-500 hover:bg-orange-400 active:bg-orange-600 text-white font-black text-xl py-4 rounded-2xl transition-colors mt-6"
        >
          {buttonLabel}
        </button>
      </div>
    </div>,
    document.body
  )
}
