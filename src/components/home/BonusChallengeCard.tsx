'use client'

import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils'
import type { BonusChallengeWeek, BonusChallenge, BonusLog, User } from '@/types'

interface BonusChallengeCardProps {
  bonus: BonusChallenge
  activeWeek: BonusChallengeWeek
  myLog: BonusLog | null
  weekLogs: BonusLog[]
  allUsers: User[]
  totalPAX: number
  onComplete: () => Promise<void>
  saving: boolean
}

export function BonusChallengeCard({
  bonus,
  activeWeek,
  myLog,
  weekLogs,
  allUsers,
  totalPAX,
  onComplete,
  saving,
}: BonusChallengeCardProps) {
  const isDone = !!myLog
  const completedCount = weekLogs.length

  const completedNames = weekLogs
    .map(l => allUsers.find(u => u.id === l.userId)?.displayName)
    .filter(Boolean) as string[]

  return (
    <div className="rounded-2xl bg-blue-950/30 border border-blue-700/40 px-4 py-4 space-y-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="text-blue-400 mt-0.5 text-lg shrink-0">🏃</span>
        <div className="flex-1 min-w-0">
          <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">
            Bonus — {bonus.name}
          </p>
          <p className="text-white text-sm font-medium mt-0.5">{activeWeek.description}</p>
          <p className="text-zinc-500 text-xs mt-1">
            {formatDate(activeWeek.startDate)} – {formatDate(activeWeek.endDate)} · Complete once this week
          </p>
        </div>
      </div>

      {/* Group count */}
      {totalPAX > 0 && (
        <div className="flex items-center gap-2 px-0.5">
          <span className="text-sm">💪</span>
          <p className="text-sm text-zinc-400">
            <span className="font-semibold text-zinc-200">{completedCount}/{totalPAX}</span>
            {' '}PAX completed this week
          </p>
        </div>
      )}

      {/* Who completed it */}
      {completedNames.length > 0 && (
        <p className="text-xs text-zinc-500 px-0.5 leading-relaxed">
          {completedNames.join(', ')}
        </p>
      )}

      {/* Complete button */}
      <button
        onClick={isDone ? undefined : onComplete}
        disabled={isDone || saving}
        className={cn(
          'w-full rounded-xl py-2.5 text-sm font-semibold border transition-colors',
          isDone
            ? 'bg-green-900/30 text-green-400 border-green-700/40 cursor-default'
            : saving
            ? 'bg-blue-900/30 text-blue-400 border-blue-700/40 cursor-wait opacity-60'
            : 'bg-blue-500/15 text-blue-300 border-blue-600/40 hover:bg-blue-500/25 active:scale-[0.98]'
        )}
      >
        {isDone ? '✓ Completed this week' : saving ? 'Saving…' : 'Mark Complete'}
      </button>
    </div>
  )
}
