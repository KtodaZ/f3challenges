'use client'

import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import type { LeaderboardEntry, User } from '@/types'

interface CallOutCardProps {
  entries: LeaderboardEntry[]
  onCallOut: (user: User) => void
}

export function CallOutCard({ entries, onCallOut }: CallOutCardProps) {

  // Show only active/modifying users who haven't completed today
  const needsPush = entries.filter(
    e =>
      e.participation?.status !== 'opted-out' &&
      !e.todayComplete
  )

  if (needsPush.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Who needs a push?</CardTitle>
        </CardHeader>
        <p className="text-sm text-zinc-400">
          Everyone&apos;s crushed it today. F3 Bedrock! 💪
        </p>
      </Card>
    )
  }

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800">
        <div className="flex items-baseline gap-2">
          <h3 className="font-bold text-white text-base">Who needs a push?</h3>
          <span className="text-xs text-zinc-500">{needsPush.length} not done yet</span>
        </div>
      </div>
      <ul>
        {needsPush.map((entry) => (
          <li key={entry.user.id}>
            <button
              onClick={() => onCallOut(entry.user)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/50 active:bg-zinc-700/50 transition-colors border-b border-zinc-800 last:border-b-0 text-left"
            >
              <Avatar name={entry.user.displayName} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {entry.user.displayName}
                </p>
                {entry.todayLog && entry.todayLog.completionFraction > 0 && (
                  <p className="text-xs text-amber-400">Partially done</p>
                )}
              </div>
              <span className="text-xs text-orange-400 font-medium shrink-0">
                Send a shoutout →
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
