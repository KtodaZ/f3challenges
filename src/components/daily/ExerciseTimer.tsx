'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { cn, formatClock } from '@/lib/utils'
import {
  playAlarm,
  playCountdownTick,
  playGo,
  playWarning,
} from '@/lib/timerAudio'

interface ExerciseTimerProps {
  open: boolean
  onClose: () => void
  exerciseName: string
  targetSeconds: number
  /** Seconds already logged today — the timer adds on top of these. */
  bankedSeconds: number
  /** Called with the new total (banked + timed) in seconds. */
  onSave: (totalSeconds: number) => void
}

// countdown = 3-2-1 get-ready phase (also used when resuming, so you have
// time to get back on the bar); running/paused are the work phases.
type Phase = 'countdown' | 'running' | 'paused'

const GET_READY_SECONDS = 3
const ADJUSTMENTS = [-15, -5, 5, 15]
const MUTE_STORAGE_KEY = 'exerciseTimerMuted'

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern)
  }
}

function TimerRing({ fraction, done, children }: {
  fraction: number
  done: boolean
  children: React.ReactNode
}) {
  const size = 280
  const strokeWidth = 12
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.min(1, Math.max(0, fraction)))

  return (
    <div className="relative w-full max-w-[280px] aspect-square">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="#27272a" strokeWidth={strokeWidth} fill="none"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={done ? '#22c55e' : '#f97316'}
          strokeWidth={strokeWidth} fill="none" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-300"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  )
}

export function ExerciseTimer({
  open,
  onClose,
  exerciseName,
  targetSeconds,
  bankedSeconds,
  onSave,
}: ExerciseTimerProps) {
  const [phase, setPhase] = useState<Phase>('countdown')
  const [countdown, setCountdown] = useState(GET_READY_SECONDS)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [muted, setMuted] = useState(false)

  // Timing is timestamp-based (not tick-counting) so it stays accurate even
  // if the phone throttles JS or the screen locks mid-set.
  const accumMsRef = useRef(0)          // ms banked from finished segments + adjustments
  const segStartRef = useRef<number | null>(null) // Date.now() when the running segment began
  const warned10Ref = useRef(false)
  const alarmFiredRef = useRef(false)
  const mutedRef = useRef(false)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  const sound = useCallback((fn: () => void) => {
    if (!mutedRef.current) fn()
  }, [])

  function currentElapsedMs() {
    return accumMsRef.current + (segStartRef.current !== null ? Date.now() - segStartRef.current : 0)
  }

  // ── Reset on open ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    accumMsRef.current = 0
    segStartRef.current = null
    setElapsedMs(0)
    setPhase('countdown')
    setCountdown(GET_READY_SECONDS)
    // Don't blast cues for credit that was already banked before opening
    const startingRemaining = targetSeconds - bankedSeconds
    alarmFiredRef.current = startingRemaining <= 0
    warned10Ref.current = startingRemaining <= 10
    try {
      setMutedState(localStorage.getItem(MUTE_STORAGE_KEY) === '1')
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function setMutedState(value: boolean) {
    mutedRef.current = value
    setMuted(value)
  }

  function toggleMute() {
    const next = !mutedRef.current
    setMutedState(next)
    try { localStorage.setItem(MUTE_STORAGE_KEY, next ? '1' : '0') } catch { /* ignore */ }
  }

  // ── Get-ready countdown (3…2…1…go) ───────────────────────────────────────
  useEffect(() => {
    if (!open || phase !== 'countdown') return
    if (countdown <= 0) {
      sound(playGo)
      vibrate(100)
      segStartRef.current = Date.now()
      setPhase('running')
      return
    }
    sound(playCountdownTick)
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [open, phase, countdown, sound])

  // ── Running tick ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || phase !== 'running') return
    const iv = setInterval(() => {
      if (segStartRef.current !== null) {
        setElapsedMs(accumMsRef.current + Date.now() - segStartRef.current)
      }
    }, 100)
    return () => clearInterval(iv)
  }, [open, phase])

  // ── Audio/haptic cues at 10s-left and at the target ───────────────────────
  useEffect(() => {
    if (!open || phase !== 'running') return
    const remaining = targetSeconds - bankedSeconds - elapsedMs / 1000
    if (remaining <= 0 && !alarmFiredRef.current) {
      alarmFiredRef.current = true
      sound(playAlarm)
      vibrate([200, 120, 200, 120, 500])
    } else if (remaining <= 10 && remaining > 0 && !warned10Ref.current) {
      warned10Ref.current = true
      sound(playWarning)
      vibrate(80)
    }
  }, [open, phase, elapsedMs, targetSeconds, bankedSeconds, sound])

  // ── Keep the screen awake while the timer is open ─────────────────────────
  useEffect(() => {
    if (!open || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
    let released = false
    async function acquire() {
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (released) { lock.release().catch(() => {}) } else { wakeLockRef.current = lock }
      } catch { /* wake lock is best-effort */ }
    }
    void acquire()
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !released) void acquire()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisibility)
      wakeLockRef.current?.release().catch(() => {})
      wakeLockRef.current = null
    }
  }, [open])

  // ── Actions ───────────────────────────────────────────────────────────────

  function pause() {
    if (segStartRef.current !== null) {
      accumMsRef.current += Date.now() - segStartRef.current
      segStartRef.current = null
    }
    setElapsedMs(accumMsRef.current)
    setPhase('paused')
    vibrate(30)
  }

  function resume() {
    // Re-run the get-ready countdown so you have time to get back on the bar
    setCountdown(GET_READY_SECONDS)
    setPhase('countdown')
    vibrate(30)
  }

  function skipCountdown() {
    setCountdown(0)
  }

  function adjust(deltaSeconds: number) {
    const next = Math.max(0, currentElapsedMs() + deltaSeconds * 1000)
    accumMsRef.current = next
    if (segStartRef.current !== null) segStartRef.current = Date.now()
    setElapsedMs(next)
    // Re-arm cues if the correction moved us back before them
    const remaining = targetSeconds - bankedSeconds - next / 1000
    if (remaining > 0) alarmFiredRef.current = false
    if (remaining > 10) warned10Ref.current = false
    vibrate(20)
  }

  function requestClose() {
    if (currentElapsedMs() >= 3000 && !window.confirm('Discard this timed session?')) return
    onClose()
  }

  function handleSave() {
    onSave(bankedSeconds + Math.round(currentElapsedMs() / 1000))
  }

  // ── Derived display values ────────────────────────────────────────────────

  const elapsedSeconds = elapsedMs / 1000
  const totalSeconds = bankedSeconds + elapsedSeconds
  const remainingSeconds = targetSeconds - totalSeconds
  const done = remainingSeconds <= 0
  const fraction = targetSeconds > 0 ? totalSeconds / targetSeconds : 1
  const isCountdown = phase === 'countdown'

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) requestClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/80" />
        <Dialog.Content
          className="fixed inset-0 z-[60] bg-zinc-950 flex flex-col outline-none"
          aria-describedby={undefined}
        >
          <div className="w-full max-w-md mx-auto flex-1 flex flex-col px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">

            {/* ── Header ── */}
            <div className="flex items-center justify-between mb-2">
              <div className="min-w-0">
                <Dialog.Title className="text-lg font-bold text-white truncate">
                  {exerciseName}
                </Dialog.Title>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Goal: {formatClock(targetSeconds)}
                  {bankedSeconds > 0 && ` · ${formatClock(bankedSeconds)} already banked`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-3">
                <button
                  onClick={toggleMute}
                  className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                  aria-label={muted ? 'Unmute timer sounds' : 'Mute timer sounds'}
                >
                  {muted ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.7-.51-1.94-1.36a9.02 9.02 0 010-4.76c.24-.85 1.06-1.36 1.94-1.36h2.24z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.11 4.89a10.5 10.5 0 010 14.22M16.46 7.54a6.75 6.75 0 010 8.92M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.7-.51-1.94-1.36a9.02 9.02 0 010-4.76c.24-.85 1.06-1.36 1.94-1.36h2.24z" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={requestClose}
                  className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                  aria-label="Close timer"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* ── Ring + time ── */}
            <div className="flex-1 flex flex-col items-center justify-center gap-5">
              <TimerRing fraction={fraction} done={done}>
                {isCountdown ? (
                  <>
                    <p className="text-zinc-400 text-sm font-medium uppercase tracking-widest">
                      Get ready…
                    </p>
                    <p className="text-8xl font-extrabold text-orange-400 tabular-nums leading-none mt-2">
                      {Math.max(1, countdown)}
                    </p>
                  </>
                ) : done ? (
                  <>
                    <p className="text-green-400 text-sm font-bold uppercase tracking-widest">
                      Goal reached! 🎉
                    </p>
                    <p className="text-6xl font-extrabold text-green-400 tabular-nums leading-none mt-2">
                      +{formatClock(-remainingSeconds)}
                    </p>
                    <p className="text-zinc-500 text-sm mt-2 tabular-nums">
                      {formatClock(totalSeconds)} total
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-zinc-500 text-sm font-medium uppercase tracking-widest">
                      {phase === 'paused' ? 'Paused' : 'Remaining'}
                    </p>
                    <p className={cn(
                      'text-7xl font-extrabold tabular-nums leading-none mt-2',
                      phase === 'paused' ? 'text-zinc-300' : 'text-white'
                    )}>
                      {formatClock(Math.ceil(remainingSeconds))}
                    </p>
                    <p className="text-zinc-500 text-sm mt-2 tabular-nums">
                      {formatClock(totalSeconds)} / {formatClock(targetSeconds)}
                    </p>
                  </>
                )}
              </TimerRing>

              {/* ── Corrections ── */}
              <div className="grid grid-cols-4 gap-2 w-full">
                {ADJUSTMENTS.map(delta => (
                  <button
                    key={delta}
                    onClick={() => adjust(delta)}
                    disabled={isCountdown && elapsedMs === 0 && delta < 0}
                    className={cn(
                      'py-3 rounded-xl text-sm font-semibold transition-colors tabular-nums',
                      'bg-zinc-900 border border-zinc-800 text-zinc-300',
                      'hover:bg-zinc-800 active:bg-zinc-700',
                      'disabled:opacity-40 disabled:cursor-not-allowed'
                    )}
                  >
                    {delta > 0 ? `+${delta}s` : `−${Math.abs(delta)}s`}
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-600 -mt-2 text-center">
                Grip slipped? Pause, then correct the time before your next set.
              </p>
            </div>

            {/* ── Primary controls ── */}
            <div className="space-y-3 mt-6">
              {isCountdown ? (
                <button
                  onClick={skipCountdown}
                  className="w-full py-4 rounded-2xl bg-orange-500 hover:bg-orange-400 active:bg-orange-600 text-white text-lg font-bold transition-colors"
                >
                  Go Now
                </button>
              ) : phase === 'running' ? (
                <button
                  onClick={pause}
                  className="w-full py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-white text-lg font-bold transition-colors"
                >
                  ⏸ Pause
                </button>
              ) : (
                <button
                  onClick={resume}
                  className="w-full py-4 rounded-2xl bg-orange-500 hover:bg-orange-400 active:bg-orange-600 text-white text-lg font-bold transition-colors"
                >
                  ▶ Resume
                </button>
              )}

              <button
                onClick={handleSave}
                disabled={isCountdown && elapsedMs === 0}
                className={cn(
                  'w-full py-4 rounded-2xl text-lg font-bold transition-colors',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                  done
                    ? 'bg-green-600 hover:bg-green-500 active:bg-green-700 text-white'
                    : 'bg-zinc-900 border border-zinc-700 text-zinc-200 hover:bg-zinc-800'
                )}
              >
                Save {formatClock(totalSeconds)}
              </button>
            </div>

          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
