'use client'

import { useRef, useState, useMemo, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { LineChart, type LinePoint } from './LineChart'
import { GroupHeatMap } from './GroupHeatMap'
import { getChallengeDates, getTodayPT } from '@/lib/challenges'
import { formatDate, cn } from '@/lib/utils'
import type { ChallengeTemplate } from '@/types'

interface GroupChartsProps {
  challenge: ChallengeTemplate
  dayCompletionCounts: Record<string, number>
  dayRepCounts: Record<string, number>
  participantCount: number
}

/** Compact rep counts: 1240 → "1.2k", 12400 → "12k". */
function compact(n: number): string {
  if (n < 1000) return n.toLocaleString()
  const k = n / 1000
  return `${k >= 10 ? Math.round(k) : k.toFixed(1)}k`
}

const PANELS = ['Total Reps', '% Completing', 'Activity Grid'] as const

export function GroupCharts({
  challenge,
  dayCompletionCounts,
  dayRepCounts,
  participantCount,
}: GroupChartsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  const today = getTodayPT()
  const pastDates = useMemo(
    () => getChallengeDates(challenge).filter(d => d <= today),
    [challenge, today]
  )

  const repPoints: LinePoint[] = useMemo(
    () =>
      pastDates.map((date, i) => ({
        label: `${i + 1}`,
        fullLabel: formatDate(date),
        value: dayRepCounts[date] ?? 0,
      })),
    [pastDates, dayRepCounts]
  )

  const pctPoints: LinePoint[] = useMemo(
    () =>
      pastDates.map((date, i) => ({
        label: `${i + 1}`,
        fullLabel: formatDate(date),
        value: participantCount > 0
          ? Math.round(((dayCompletionCounts[date] ?? 0) / participantCount) * 100)
          : 0,
      })),
    [pastDates, dayCompletionCounts, participantCount]
  )

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const idx = Math.round(el.scrollLeft / el.clientWidth)
    setActive(prev => (prev === idx ? prev : idx))
  }, [])

  const goTo = useCallback((idx: number) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' })
  }, [])

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <h2 className="text-sm font-semibold text-white">Group Activity</h2>
        <span className="text-xs text-zinc-500">swipe →</span>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {/* Panel 1 — total reps */}
        <div className="snap-center shrink-0 w-full px-4 pb-3">
          <div className="flex items-baseline justify-between mb-1">
            <p className="text-xs font-medium text-zinc-300">Total reps per day</p>
            <span className="text-[11px] text-zinc-500">month to date</span>
          </div>
          <LineChart points={repPoints} color="#f97316" formatValue={compact} unit="reps" />
        </div>

        {/* Panel 2 — % completion by day */}
        <div className="snap-center shrink-0 w-full px-4 pb-3">
          <div className="flex items-baseline justify-between mb-1">
            <p className="text-xs font-medium text-zinc-300">% of PAX completing each day</p>
            <span className="text-[11px] text-zinc-500">of {participantCount} in</span>
          </div>
          <LineChart
            points={pctPoints}
            color="#22c55e"
            yMax={100}
            formatValue={v => `${v}%`}
            unit="done"
          />
        </div>

        {/* Panel 3 — heatmap */}
        <div className="snap-center shrink-0 w-full px-4 pb-3">
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-xs font-medium text-zinc-300">Completion grid</p>
            <span className="text-[11px] text-zinc-500">tap a day</span>
          </div>
          <GroupHeatMap
            challenge={challenge}
            dayCompletionCounts={dayCompletionCounts}
            activeCount={participantCount}
          />
        </div>
      </div>

      {/* Dots */}
      <div className="flex items-center justify-center gap-1.5 pb-3">
        {PANELS.map((label, i) => (
          <button
            key={label}
            aria-label={label}
            onClick={() => goTo(i)}
            className={cn(
              'h-1.5 rounded-full transition-all',
              i === active ? 'w-4 bg-zinc-300' : 'w-1.5 bg-zinc-700'
            )}
          />
        ))}
      </div>
    </Card>
  )
}
