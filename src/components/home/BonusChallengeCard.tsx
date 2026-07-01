'use client'

import { useState } from 'react'
import { cn, formatDate } from '@/lib/utils'
import { BonusRevealModal } from './BonusRevealModal'
import type { BonusChallengeWeek, BonusChallenge, BonusLog, User } from '@/types'

interface BonusChallengeCardProps {
  challengeId: string
  bonus: BonusChallenge
  activeWeek: BonusChallengeWeek
  myLog: BonusLog | null
  weekLogs: BonusLog[]
  allUsers: User[]
  totalPAX: number
  onComplete: () => Promise<void>
  saving: boolean
}

function revealKey(challengeId: string, weekStartDate: string) {
  return `bonusRevealed_${challengeId}_${weekStartDate}`
}

export function BonusChallengeCard({
  challengeId,
  bonus,
  activeWeek,
  myLog,
  weekLogs,
  allUsers,
  totalPAX,
  onComplete,
  saving,
}: BonusChallengeCardProps) {
  const [revealed, setRevealed] = useState(() => {
    try { return localStorage.getItem(revealKey(challengeId, activeWeek.startDate)) === 'true' }
    catch { return false }
  })
  const [showModal, setShowModal] = useState(false)

  function handleReveal() {
    try { localStorage.setItem(revealKey(challengeId, activeWeek.startDate), 'true') } catch { /* quota/private mode */ }
    setRevealed(true)
    setShowModal(true)
  }

  const isDone = !!myLog
  const completedCount = weekLogs.length

  const completedNames = weekLogs
    .map(l => allUsers.find(u => u.id === l.userId)?.displayName)
    .filter(Boolean) as string[]

  if (!revealed) {
    return (
      <>
        <div className="rounded-2xl bg-blue-950/20 border border-blue-700/30 px-4 py-4 space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-blue-400 mt-0.5 text-lg shrink-0">🔒</span>
            <div className="flex-1 min-w-0">
              <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">
                Bonus — {bonus.name}
              </p>
              <p className="text-zinc-500 text-sm mt-0.5 italic">This week&apos;s bonus is waiting…</p>
              <p className="text-zinc-600 text-xs mt-1">
                {formatDate(activeWeek.startDate)} – {formatDate(activeWeek.endDate)}
              </p>
            </div>
          </div>

          <button
            onClick={handleReveal}
            className="w-full rounded-xl py-2.5 text-sm font-semibold border transition-colors bg-blue-600/20 text-blue-300 border-blue-600/40 hover:bg-blue-600/30 active:scale-[0.98]"
          >
            🔓 Reveal This Week&apos;s Bonus
          </button>
        </div>

        {showModal && (
          <BonusRevealModal
            bonus={bonus}
            activeWeek={activeWeek}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    )
  }

  return (
    <>
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
    </>
  )
}
