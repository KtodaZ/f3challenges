'use client'

import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { CHALLENGES, getTodayPT } from '@/lib/challenges'
import { useUser } from '@/contexts/UserContext'
import type { User } from '@/types'

const PAST = [...CHALLENGES].filter(c => c.endDate < getTodayPT()).reverse()

interface FinisherEntry {
  user: User
  awardedAt: string
  type: 'completed' | 'participant'
}

export function PastFinishers() {
  const { allUsers } = useUser()
  const router = useRouter()

  if (PAST.length === 0) {
    return (
      <div className="py-16 text-center text-zinc-500 text-sm px-4">
        No past challenges yet.
      </div>
    )
  }

  return (
    <div className="space-y-4 px-4 py-4">
      {PAST.map(challenge => {
        const entries: FinisherEntry[] = allUsers
          .flatMap(user => {
            const badge = user.badges?.find(b => b.challengeId === challenge.id)
            if (!badge) return []
            return [{ user, awardedAt: badge.awardedAt, type: badge.type }]
          })
          .sort((a, b) => {
            if (a.type !== b.type) return a.type === 'completed' ? -1 : 1
            return a.awardedAt.localeCompare(b.awardedAt)
          })

        const finishers = entries.filter(e => e.type === 'completed')
        const participants = entries.filter(e => e.type === 'participant')

        return (
          <div key={challenge.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            {/* Challenge header */}
            <div className="px-4 py-3 border-b border-zinc-800">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{challenge.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {new Date(challenge.startDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    {' · '}{challenge.exercises.map(e => e.shortName).join(', ')}
                  </p>
                </div>
                {finishers.length > 0 && (
                  <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full shrink-0">
                    {finishers.length} finisher{finishers.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            {entries.length === 0 ? (
              <div className="px-4 py-6 text-center text-zinc-500 text-sm">
                No finishers recorded
              </div>
            ) : (
              <div>
                {finishers.map((entry, idx) => (
                  <button
                    key={entry.user.id}
                    onClick={() => router.push(`/profile/${entry.user.id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 border-b border-zinc-800/60 last:border-b-0 hover:bg-zinc-800/50 active:bg-zinc-700/50 transition-colors text-left"
                  >
                    <div className="w-8 shrink-0 text-center">
                      {idx === 0 ? <span className="text-lg leading-none">🥇</span>
                        : idx === 1 ? <span className="text-lg leading-none">🥈</span>
                        : idx === 2 ? <span className="text-lg leading-none">🥉</span>
                        : <span className="text-sm font-bold text-zinc-400">{idx + 1}</span>}
                    </div>
                    <Avatar name={entry.user.displayName} size="sm" />
                    <span className="flex-1 text-sm font-semibold text-white truncate">
                      {entry.user.displayName}
                    </span>
                    <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full shrink-0">
                      🏆 Finished
                    </span>
                  </button>
                ))}
                {participants.map(entry => (
                  <button
                    key={entry.user.id}
                    onClick={() => router.push(`/profile/${entry.user.id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 border-b border-zinc-800/60 last:border-b-0 hover:bg-zinc-800/50 active:bg-zinc-700/50 transition-colors text-left"
                  >
                    <div className="w-8 shrink-0 text-center">
                      <span className="text-sm text-zinc-600">—</span>
                    </div>
                    <Avatar name={entry.user.displayName} size="sm" />
                    <span className="flex-1 text-sm font-medium text-zinc-400 truncate">
                      {entry.user.displayName}
                    </span>
                    <span className="text-xs font-medium text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full shrink-0">
                      🎖 Participated
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
