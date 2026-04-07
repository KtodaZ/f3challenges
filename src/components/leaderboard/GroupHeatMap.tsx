'use client'

import { useState } from 'react'
import { getChallengeDates, getDailyTarget, getTodayPT } from '@/lib/challenges'
import { formatDate } from '@/lib/utils'
import type { ChallengeTemplate } from '@/types'

interface GroupHeatMapProps {
  challenge: ChallengeTemplate
  dayCompletionCounts: Record<string, number>
  activeCount: number
}

function cellColor(count: number, total: number): string {
  if (total === 0 || count === 0) return 'bg-zinc-800'
  const pct = count / total
  if (pct >= 1) return 'bg-green-500'
  if (pct >= 0.75) return 'bg-orange-500'
  if (pct >= 0.5) return 'bg-orange-700'
  return 'bg-orange-900'
}

export function GroupHeatMap({ challenge, dayCompletionCounts, activeCount }: GroupHeatMapProps) {
  const [tooltip, setTooltip] = useState<{ date: string; x: number; y: number } | null>(null)

  const dates = getChallengeDates(challenge)
  const today = getTodayPT()

  const tooltipCount = tooltip ? (dayCompletionCounts[tooltip.date] ?? 0) : 0
  const tooltipTarget = tooltip ? getDailyTarget(challenge, tooltip.date) : null

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-[3px]" onMouseLeave={() => setTooltip(null)}>
        {dates.map((date) => {
          const count = dayCompletionCounts[date] ?? 0
          const isFuture = date > today
          const color = isFuture ? 'bg-zinc-800/50' : cellColor(count, activeCount)
          const dayNum = dates.indexOf(date) + 1

          return (
            <div
              key={date}
              onMouseEnter={(e) => {
                const rect = (e.target as HTMLElement).getBoundingClientRect()
                setTooltip({ date, x: rect.left, y: rect.top })
              }}
              onTouchStart={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                setTooltip({ date, x: rect.left, y: rect.top })
              }}
            >
              <div
                className={`w-[14px] h-[14px] rounded-[3px] cursor-pointer transition-transform hover:scale-110 ${color} ${isFuture ? 'opacity-40' : ''}`}
                aria-label={`Day ${dayNum}: ${date}`}
              />
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <span className="text-xs text-zinc-500">0%</span>
        {(['bg-zinc-800', 'bg-orange-900', 'bg-orange-700', 'bg-orange-500', 'bg-green-500'] as const).map((cls, i) => (
          <div key={i} className={`w-3 h-3 rounded-sm ${cls}`} />
        ))}
        <span className="text-xs text-zinc-500">100%</span>
        <span className="text-xs text-zinc-600 ml-1">PAX completed</span>
      </div>

      {/* Floating tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white shadow-xl pointer-events-none"
          style={{ top: tooltip.y - 80, left: Math.min(tooltip.x, window.innerWidth - 180) }}
        >
          <p className="font-semibold text-zinc-200">{formatDate(tooltip.date)}</p>
          {tooltipTarget && (
            <p className="text-zinc-400">Target: {tooltipTarget.totalReps} reps</p>
          )}
          {tooltip.date <= today ? (
            <p className={tooltipCount === activeCount ? 'text-green-400 font-medium' : 'text-orange-400'}>
              {tooltipCount} / {activeCount} PAX completed
            </p>
          ) : (
            <p className="text-zinc-500">Upcoming</p>
          )}
        </div>
      )}
    </div>
  )
}
