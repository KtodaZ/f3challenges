'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cn, formatDate } from '@/lib/utils'
import { getDailyTarget, getDayNumber } from '@/lib/challenges'
import { Modal } from '@/components/ui/Modal'
import { DailyExerciseCard } from './DailyExerciseCard'
import type { ChallengeTemplate, DailyLog, DailyTarget } from '@/types'

interface DayLogCarouselProps {
  challenge: ChallengeTemplate
  today: string
  /** Past incomplete dates for THIS challenge, ascending (YYYY-MM-DD). */
  missedDates: string[]
  /** Logs keyed by date — covers both today and the missed days. */
  logsByDate: Record<string, DailyLog>
  /** Whether to include today's slide (false on a rest day — makeup only). */
  includeToday: boolean

  // ── Today slide ──
  /** Status card (completion dial + greeting) rendered atop today's slide. */
  todayHeader: ReactNode
  todayTarget: DailyTarget
  todayReps: Record<string, number>
  onTodayReps: (exerciseId: string, reps: number) => void
  todaySaving: boolean
  isDayDone: boolean

  // ── Make-up days (immediate quick-tap save, no modal) ──
  onMakeupReps: (date: string, repsMap: Record<string, number>) => Promise<void>
}

function repsFromLog(target: DailyTarget | null, log: DailyLog | undefined): Record<string, number> {
  const map: Record<string, number> = {}
  for (const { exercise } of target?.exercises ?? []) {
    map[exercise.id] = log?.exerciseLogs.find(el => el.exerciseId === exercise.id)?.completedReps ?? 0
  }
  return map
}

export function DayLogCarousel({
  challenge,
  today,
  missedDates,
  logsByDate,
  includeToday,
  todayHeader,
  todayTarget,
  todayReps,
  onTodayReps,
  todaySaving,
  isDayDone,
  onMakeupReps,
}: DayLogCarouselProps) {
  // Slides run oldest → newest, with today pinned on the far right so it's the
  // default view; swiping left steps back through the days still owed.
  const slides = useMemo(
    () => (includeToday ? [...missedDates, today] : [...missedDates]),
    [missedDates, today, includeToday]
  )
  const scrollRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(slides.length - 1)
  const [jumpOpen, setJumpOpen] = useState(false)

  // Optimistic reps for make-up days — kept in a ref so rapid taps across
  // different exercises never save a stale map back to Firestore.
  const makeupRef = useRef<Record<string, Record<string, number>>>({})
  const [, forceRender] = useState(0)

  const seedMakeup = useCallback((date: string): Record<string, number> => {
    if (!makeupRef.current[date]) {
      makeupRef.current[date] = repsFromLog(getDailyTarget(challenge, date), logsByDate[date])
    }
    return makeupRef.current[date]
  }, [challenge, logsByDate])

  const handleMakeupChange = useCallback(async (date: string, exerciseId: string, reps: number) => {
    const next = { ...seedMakeup(date), [exerciseId]: reps }
    makeupRef.current = { ...makeupRef.current, [date]: next }
    forceRender(n => n + 1)
    await onMakeupReps(date, next)
  }, [seedMakeup, onMakeupReps])

  // Slides differ in height (a done "today" is just the status card; a make-up
  // day carries a full stack of exercise cards). Size the viewport to the
  // slide(s) currently in view so a short slide never leaves dead space below.
  const [viewportH, setViewportH] = useState<number>()

  const recomputeHeight = useCallback(() => {
    const el = scrollRef.current
    if (!el || el.clientWidth === 0) return
    const pos = el.scrollLeft / el.clientWidth
    const i = Math.floor(pos + 0.001)
    const frac = pos - i
    const kids = el.children
    let h = (kids[i] as HTMLElement | undefined)?.offsetHeight ?? 0
    // Mid-swipe: keep room for whichever neighbour is bleeding into view.
    if (frac > 0.01 && kids[i + 1]) h = Math.max(h, (kids[i + 1] as HTMLElement).offsetHeight)
    if (h > 0) setViewportH(h)
  }, [])

  // Land on today (or the most recent missed day) without an animated scroll.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = (slides.length - 1) * el.clientWidth
    recomputeHeight()
    // Run once on mount — later slide changes shouldn't yank the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-measure when a slide's own content changes height (e.g. today flips to
  // done and sheds its Quick Tap cards) or the container is resized.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => recomputeHeight())
    ro.observe(el)
    for (const child of Array.from(el.children)) ro.observe(child)
    return () => ro.disconnect()
  }, [recomputeHeight, slides.length])

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const idx = Math.round(el.scrollLeft / el.clientWidth)
    setActive(prev => (prev === idx ? prev : idx))
    recomputeHeight()
  }, [recomputeHeight])

  const goTo = useCallback((idx: number) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' })
  }, [])

  if (slides.length === 0) return null

  const hasMissed = missedDates.length > 0
  const activeDate = slides[Math.min(active, slides.length - 1)]
  const activeIsToday = activeDate === today

  return (
    <div>
      {/* ── Header: label reflects the active day + jump-to control ── */}
      <div className="flex items-center justify-between px-1 mb-2 min-h-[24px]">
        {activeIsToday ? (
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Quick Tap
          </p>
        ) : (
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
            Make-Up · {formatDate(activeDate)}
          </p>
        )}
        {hasMissed && (
          <div className="flex items-center gap-3">
            {/* Swipe affordance — only while earlier days sit to the left */}
            {active > 0 && (
              <span
                className="swipe-hint flex items-center gap-0.5 text-[11px] font-semibold text-amber-400/80 uppercase tracking-wide"
                aria-hidden="true"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 6l-6 6 6 6M11 6l-6 6 6 6" />
                </svg>
                Swipe
              </span>
            )}
            <button
              onClick={() => setJumpOpen(true)}
              className="flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-amber-300 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Jump to a day
            </button>
          </div>
        )}
      </div>

      {/* ── Swipeable slides ── */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        style={viewportH ? { height: viewportH } : undefined}
        className="flex items-start overflow-x-auto overflow-y-hidden snap-x snap-mandatory transition-[height] duration-200 ease-out [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map(date => {
          const isTodaySlide = date === today
          const target = isTodaySlide ? todayTarget : getDailyTarget(challenge, date)
          if (!target) return null

          if (isTodaySlide) {
            return (
              <div key={date} className="snap-center shrink-0 w-full px-0.5 space-y-2">
                {todayHeader}
                {!isDayDone && target.exercises.map(({ exercise, reps }) => (
                  <DailyExerciseCard
                    key={exercise.id}
                    exerciseId={exercise.id}
                    name={exercise.name}
                    targetReps={reps}
                    completedReps={todayReps[exercise.id] ?? 0}
                    onChange={onTodayReps}
                    disabled={todaySaving}
                    unit={exercise.unit}
                  />
                ))}
              </div>
            )
          }

          // ── Make-up day slide ──
          const log = logsByDate[date]
          const dayNum = getDayNumber(challenge, date) ?? 0
          const fraction = log?.completionFraction ?? 0
          const pct = Math.round(fraction * 100)
          const reps = makeupRef.current[date] ?? repsFromLog(target, log)

          return (
            <div key={date} className="snap-center shrink-0 w-full px-0.5 space-y-2">
              <div className="rounded-2xl border border-amber-700/50 bg-amber-950/25 px-4 py-3 flex items-center gap-3">
                <span className="text-2xl shrink-0" role="img" aria-label="make-up day">⏪</span>
                <div className="flex-1 min-w-0">
                  <p className="text-amber-300 font-bold text-sm leading-tight">
                    Make up Day {dayNum}
                  </p>
                  <p className="text-amber-400/70 text-xs mt-0.5">{formatDate(date)}</p>
                </div>
                <span className={cn('text-sm font-bold shrink-0', fraction >= 1 ? 'text-green-400' : 'text-amber-300')}>
                  {pct}%
                </span>
              </div>
              {target.exercises.map(({ exercise, reps: targetReps }) => (
                <DailyExerciseCard
                  key={exercise.id}
                  exerciseId={exercise.id}
                  name={exercise.name}
                  targetReps={targetReps}
                  completedReps={reps[exercise.id] ?? 0}
                  onChange={(exId, r) => handleMakeupChange(date, exId, r)}
                  unit={exercise.unit}
                  accent="amber"
                />
              ))}
            </div>
          )
        })}
      </div>

      {/* ── Dots (only when there's more than today to see) ── */}
      {hasMissed && (
        <div className="flex items-center justify-center gap-1.5 pt-3">
          {slides.map((date, i) => {
            const isToday = date === today
            return (
              <button
                key={date}
                aria-label={isToday ? 'Today' : `Make up ${formatDate(date)}`}
                onClick={() => goTo(i)}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === active
                    ? isToday ? 'w-4 bg-orange-400' : 'w-4 bg-amber-400'
                    : isToday ? 'w-1.5 bg-orange-500/40' : 'w-1.5 bg-amber-600/40'
                )}
              />
            )
          })}
        </div>
      )}

      {/* ── Jump-to-a-day picker ── */}
      <Modal
        open={jumpOpen}
        onClose={() => setJumpOpen(false)}
        title="Jump to a day"
        description="Pick a day to log — tap the exercises to quick-tap your way through it."
      >
        <div className="space-y-2">
          {slides.map((date, i) => {
            const isToday = date === today
            const dayNum = getDayNumber(challenge, date) ?? 0
            const fraction = logsByDate[date]?.completionFraction ?? 0
            const pct = Math.round(fraction * 100)
            return (
              <button
                key={date}
                onClick={() => { goTo(i); setJumpOpen(false) }}
                className={cn(
                  'w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                  isToday
                    ? 'border-orange-600/40 bg-orange-950/20 hover:bg-orange-950/40'
                    : 'border-amber-800/40 bg-amber-950/15 hover:bg-amber-950/35'
                )}
              >
                <span className="text-lg shrink-0">{isToday ? '📍' : '⏪'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">
                    {isToday ? `Today · Day ${dayNum}` : `Day ${dayNum}`}
                  </p>
                  <p className="text-xs text-zinc-500">{formatDate(date)}</p>
                </div>
                <span className={cn(
                  'text-xs font-bold shrink-0',
                  fraction >= 1 ? 'text-green-400' : fraction > 0 ? 'text-amber-300' : 'text-zinc-600'
                )}>
                  {fraction > 0 ? `${pct}%` : '—'}
                </span>
              </button>
            )
          })}
        </div>
      </Modal>
    </div>
  )
}
