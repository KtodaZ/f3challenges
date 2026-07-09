'use client'

import Link from 'next/link'
import { nearMissLabel } from '@/lib/challenges'
import type { AchievementEvaluation } from '@/types'

interface NextBadgeCardProps {
  nextUp: AchievementEvaluation[]
  /** True when the user has missed days available to make up right now. */
  hasMissedDays?: boolean
}

/**
 * "Next badge" near-miss advertising: the one or two achievements the user is
 * closest to earning, with a progress bar and a nudge. Comeback badges point
 * at the Catch Up section when there are missed days to claim them with.
 */
export function NextBadgeCard({ nextUp, hasMissedDays }: NextBadgeCardProps) {
  if (nextUp.length === 0) return null

  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          🏅 Next badge
        </p>
        <Link
          href="/profile"
          className="text-xs text-orange-400 hover:text-orange-300 font-medium"
        >
          Trophy case →
        </Link>
      </div>

      <div className="space-y-3">
        {nextUp.map(e => {
          const pct = Math.min(100, Math.round((e.progress.current / e.progress.target) * 100))
          const remaining = Math.max(0, e.progress.target - e.progress.current)
          const isComeback = e.def.category === 'comeback'
          return (
            <div key={e.def.id} className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xl shrink-0">
                {e.def.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-bold text-white truncate">{e.def.name}</p>
                  <p className="text-xs text-amber-400 font-semibold shrink-0">
                    {nearMissLabel(e)}
                  </p>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {isComeback && hasMissedDays && (
                  <p className="text-[11px] text-orange-400/90 mt-1">
                    ⏳ {remaining === 1
                      ? 'One makeup day in Catch Up below claims it'
                      : 'Make up missed days in Catch Up below to close the gap'}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
