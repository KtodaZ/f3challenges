'use client'

import { useState } from 'react'
import Link from 'next/link'
import { nearMissLabel } from '@/lib/challenges'
import { BadgeDetailModal } from '@/components/ui/BadgeDetailModal'
import type { BadgeDetail } from '@/components/ui/BadgeDetailModal'
import type { AchievementEvaluation } from '@/types'

interface NextBadgeCardProps {
  nextUp: AchievementEvaluation[]
  /** Badge of the Month, pinned above the near-miss rows until earned. */
  featured?: AchievementEvaluation
  /** True when the user has missed days available to make up right now. */
  hasMissedDays?: boolean
}

/**
 * "Next badge" near-miss advertising. Slot 1 is the closest badge by
 * completion ratio; the second slot rotates daily through the other
 * near-misses (see getNextAchievements). The challenge's Badge of the
 * Month stays pinned on top until earned. Tap any badge for details.
 */
export function NextBadgeCard({ nextUp, featured, hasMissedDays }: NextBadgeCardProps) {
  const [detail, setDetail] = useState<BadgeDetail | null>(null)
  const rows = nextUp.filter(e => e.def.id !== featured?.def.id)
  if (rows.length === 0 && !featured) return null

  const openDetail = (e: AchievementEvaluation) =>
    setDetail({ kind: 'achievement', item: e, earned: false })

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

      {featured && (
        <button
          type="button"
          onClick={() => openDetail(featured)}
          className="w-full text-left rounded-xl bg-gradient-to-r from-amber-950/60 to-orange-950/40 border border-amber-700/40 p-3 active:scale-[0.98] transition-transform"
        >
          <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-2">
            🎪 Badge of the Month
          </p>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-900/40 border border-amber-700/60 flex items-center justify-center text-xl shrink-0">
              {featured.def.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-bold text-white truncate">{featured.def.name}</p>
                <p className="text-xs text-amber-400 font-semibold shrink-0">
                  {nearMissLabel(featured)}
                </p>
              </div>
              <p className="text-[11px] text-zinc-400 truncate">{featured.def.description}</p>
              <div className="h-1.5 bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.round((featured.progress.current / featured.progress.target) * 100))}%` }}
                />
              </div>
            </div>
          </div>
        </button>
      )}

      <div className="space-y-3">
        {rows.map(e => {
          const pct = Math.min(100, Math.round((e.progress.current / e.progress.target) * 100))
          const remaining = Math.max(0, e.progress.target - e.progress.current)
          const isComeback = e.def.category === 'comeback'
          return (
            <button
              type="button"
              key={e.def.id}
              onClick={() => openDetail(e)}
              className="w-full text-left flex items-center gap-3 active:scale-[0.98] transition-transform"
            >
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
            </button>
          )
        })}
      </div>

      <BadgeDetailModal detail={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
