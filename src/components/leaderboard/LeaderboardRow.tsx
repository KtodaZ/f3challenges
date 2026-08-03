'use client'

import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'
import { formatLoad } from '@/lib/challenges'
import type { LeaderboardEntry } from '@/types'

interface LeaderboardRowProps {
  entry: LeaderboardEntry
  rank: number
  isCurrentUser: boolean
  onClick?: () => void
}

function rankDisplay(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return String(rank)
}

/**
 * Status badge. On a weekly-cumulative challenge the meaningful unit is the
 * week, not the day — skipping a Tuesday is allowed, coming up short on Sunday
 * is not — so the badge tracks the week's target instead of "done today".
 */
function StatusBadge({ entry }: { entry: LeaderboardEntry }) {
  const { todayComplete, todayLog, week } = entry

  if (week) {
    if (week.isComplete) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-400 shrink-0 tabular-nums">
          ✅ {week.target.toLocaleString()}
        </span>
      )
    }
    if (week.reps > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 shrink-0 tabular-nums">
          {week.reps.toLocaleString()}/{week.target.toLocaleString()}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-500 shrink-0">
        ❌ —
      </span>
    )
  }

  if (todayComplete) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-400 shrink-0">
        ✅ Done
      </span>
    )
  }

  if (todayLog && todayLog.completionFraction > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 shrink-0">
        🔄 Partial
      </span>
    )
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-500 shrink-0">
      ❌ —
    </span>
  )
}

/** The weight this PAX has done the most reps at — "2×25", "1×40". Optional,
 *  so most rows won't show one until people start logging with weight.
 *
 *  Tapping it jumps straight to the breakdown behind the number. It's a span
 *  rather than a button because the whole row is already a button and nesting
 *  those is invalid — the row still reaches the same profile for anyone
 *  navigating by keyboard, just without the anchor. */
function LoadBadge({ entry }: { entry: LeaderboardEntry }) {
  const router = useRouter()
  const badge = formatLoad(entry.load)
  if (!badge) return null
  return (
    <span
      title="Weight used — tap for the breakdown"
      onClick={e => {
        e.stopPropagation()
        router.push(`/profile/${entry.user.id}#breakdown`)
      }}
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums bg-amber-500/15 text-amber-300 shrink-0 hover:bg-amber-500/25"
    >
      🏋 {badge}
    </span>
  )
}

function ParticipationLabel({ entry }: { entry: LeaderboardEntry }) {
  const status = entry.participation?.status
  if (status === 'opted-out') {
    return <span className="text-xs text-zinc-500">(Opted out)</span>
  }
  if (status === 'modifying') {
    return <span className="text-xs text-amber-400">(Modifying)</span>
  }
  return null
}

export function LeaderboardRow({ entry, rank, isCurrentUser, onClick }: LeaderboardRowProps) {
  const router = useRouter()
  const isOptedOut = entry.participation?.status === 'opted-out'

  return (
    <button
      onClick={() => onClick ? onClick() : router.push(`/profile/${entry.user.id}`)}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 min-h-16 text-left',
        'transition-colors active:bg-zinc-700/50',
        'border-b border-zinc-800 last:border-b-0',
        isCurrentUser && 'bg-orange-500/10',
        !isCurrentUser && 'hover:bg-zinc-800/50'
      )}
    >
      {/* Rank */}
      <div className="w-8 shrink-0 text-center">
        {rank <= 3 ? (
          <span className="text-lg leading-none">{rankDisplay(rank)}</span>
        ) : (
          <span className="text-sm font-bold text-zinc-400">{rank}</span>
        )}
      </div>

      {/* Avatar + Name */}
      <Avatar name={entry.user.displayName} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              'text-sm font-semibold truncate',
              isCurrentUser ? 'text-orange-400' : 'text-white',
              isOptedOut && 'text-zinc-400'
            )}
          >
            {entry.user.displayName}
          </span>
          <LoadBadge entry={entry} />
          <ParticipationLabel entry={entry} />
        </div>
        {/* Mini progress bar */}
        <div className="mt-1 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                isOptedOut ? 'bg-zinc-600' : 'bg-orange-500'
              )}
              style={{ width: `${Math.min(100, Math.max(0, entry.completionPct))}%` }}
            />
          </div>
          <span className="text-xs text-zinc-400 shrink-0 w-8 text-right">
            {Math.round(entry.completionPct)}%
          </span>
        </div>
      </div>

      {/* Week target (weekly-cumulative) or today's completion */}
      <StatusBadge entry={entry} />

      {/* Reps + streak */}
      <div className="shrink-0 text-right space-y-0.5 min-w-[3.5rem]">
        <div className="text-sm font-semibold text-zinc-200">
          {entry.totalReps > 0 ? entry.totalReps.toLocaleString() : <span className="text-zinc-600">—</span>}
        </div>
        <div className="text-[10px] text-zinc-500">
          {entry.currentStreak > 0 ? `🔥 ${entry.currentStreak}d` : ''}
        </div>
      </div>
    </button>
  )
}
