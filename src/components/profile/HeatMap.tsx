'use client'

import { useState } from 'react'
import { getChallengeDates, getDailyTarget, getTodayPT } from '@/lib/challenges'
import { formatDate } from '@/lib/utils'
import type { ChallengeTemplate, DailyLog, CompletionFraction } from '@/types'

interface HeatMapProps {
  challenge: ChallengeTemplate
  logs: DailyLog[]
}

function cellColor(fraction: CompletionFraction | undefined): string {
  if (fraction === undefined || fraction === 0) return 'bg-zinc-800'
  if (fraction >= 1) return 'bg-green-500'
  if (fraction >= 0.75) return 'bg-orange-500'
  if (fraction >= 0.5) return 'bg-orange-700'
  return 'bg-orange-900'
}

function fractionLabel(fraction: CompletionFraction | undefined): string {
  if (!fraction) return 'No log'
  if (fraction >= 1) return 'Complete'
  if (fraction >= 0.75) return '75%'
  if (fraction >= 0.5) return '50%'
  return '25%'
}

export function HeatMap({ challenge, logs }: HeatMapProps) {
  const [tooltip, setTooltip] = useState<{ date: string; x: number; y: number } | null>(null)

  const dates = getChallengeDates(challenge)
  const today = getTodayPT()

  const logMap = new Map<string, DailyLog>()
  for (const log of logs) {
    logMap.set(log.date, log)
  }

  const tooltipLog = tooltip ? logMap.get(tooltip.date) : undefined
  const tooltipTarget = tooltip ? getDailyTarget(challenge, tooltip.date) : null

  return (
    <div className="relative">
      {/* Grid of cells */}
      <div
        className="flex flex-wrap gap-[3px]"
        onMouseLeave={() => setTooltip(null)}
      >
        {dates.map((date) => {
          const log = logMap.get(date)
          const fraction = log?.completionFraction
          const isMakeUp = log?.isMakeUp ?? false
          const isFuture = date > today
          const color = isFuture ? 'bg-zinc-800/50' : cellColor(fraction)
          const dayNum = dates.indexOf(date) + 1

          return (
            <div
              key={date}
              className="relative"
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
                className={`
                  w-[14px] h-[14px] rounded-[3px] cursor-pointer
                  transition-transform hover:scale-110
                  ${color}
                  ${isFuture ? 'opacity-40' : ''}
                `}
                aria-label={`Day ${dayNum}: ${date}`}
              />
              {/* Makeup dot indicator */}
              {isMakeUp && fraction && fraction >= 1 && (
                <div className="absolute bottom-[2px] right-[2px] w-[4px] h-[4px] rounded-full bg-white/70 pointer-events-none" />
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <span className="text-xs text-zinc-500">Less</span>
        {(['bg-zinc-800', 'bg-orange-900', 'bg-orange-700', 'bg-orange-500', 'bg-green-500'] as const).map((cls, i) => (
          <div key={i} className={`w-3 h-3 rounded-sm ${cls}`} />
        ))}
        <span className="text-xs text-zinc-500">More</span>
        <div className="flex items-center gap-1.5 ml-2">
          <div className="relative w-3 h-3 rounded-sm bg-green-500">
            <div className="absolute bottom-[1px] right-[1px] w-[3px] h-[3px] rounded-full bg-white/70" />
          </div>
          <span className="text-xs text-zinc-500">Make-up</span>
        </div>
      </div>

      {/* Floating tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white shadow-xl pointer-events-none"
          style={{ top: tooltip.y - 70, left: Math.min(tooltip.x, window.innerWidth - 200) }}
        >
          <p className="font-semibold text-zinc-200">{formatDate(tooltip.date)}</p>
          {tooltipTarget && (
            <p className="text-zinc-400">
              Target: {tooltipTarget.totalReps} reps
            </p>
          )}
          {tooltipLog ? (
            <>
              <p className="text-zinc-400">
                {tooltipLog.exerciseLogs.reduce((s, e) => s + e.completedReps, 0)} reps logged
              </p>
              <p className={`font-medium ${tooltipLog.completionFraction >= 1 ? 'text-green-400' : 'text-orange-400'}`}>
                {fractionLabel(tooltipLog.completionFraction)}
                {tooltipLog.isMakeUp && ' · Make-up'}
              </p>
            </>
          ) : (
            <p className="text-zinc-500">{tooltip.date > today ? 'Upcoming' : 'No log'}</p>
          )}
        </div>
      )}
    </div>
  )
}
