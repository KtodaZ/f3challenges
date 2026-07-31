'use client'

import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { useRegion } from '@/contexts/RegionContext'
import { Avatar } from '@/components/ui/Avatar'
import { getTodayPT } from '@/lib/challenges'
import { getPushReason, type PushTone, type PushUrgency } from '@/lib/pushPriority'
import type { LeaderboardEntry, User } from '@/types'

interface CallOutCardProps {
  entries: LeaderboardEntry[]
  onCallOut: (user: User) => void
}

const TONE_CLASS: Record<PushTone, string> = {
  close:    'text-green-400',
  progress: 'text-green-400',
  early:    'text-amber-400',
  streak:   'text-amber-400',
  idle:     'text-zinc-400',
  cold:     'text-zinc-300',
  never:    'text-zinc-300',
}

// Left accent bar communicates the computed priority tier at a glance.
const URGENCY_ACCENT: Record<PushUrgency, string> = {
  high: 'border-l-2 border-l-orange-500',
  med:  'border-l-2 border-l-amber-500/50',
  low:  'border-l-2 border-l-transparent',
}

export function CallOutCard({ entries, onCallOut }: CallOutCardProps) {
  const { region } = useRegion()
  const today = getTodayPT()

  // Only active/modifying PAX who haven't finished today. Ordered so the
  // closest-to-done (easiest wins) sit up top and the deepest holes sit at the
  // bottom — ascending by the weighted push-priority score.
  const ranked = entries
    .filter(e => e.participation?.status !== 'opted-out' && !e.todayComplete)
    .map(entry => ({ entry, reason: getPushReason(entry, today) }))
    .sort((a, b) => a.reason.score - b.reason.score)

  if (ranked.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Who needs a push?</CardTitle>
        </CardHeader>
        <p className="text-sm text-zinc-400">
          Everyone&apos;s crushed it today. {region.name}! 💪
        </p>
      </Card>
    )
  }

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800">
        <div className="flex items-baseline gap-2">
          <h3 className="font-bold text-white text-base">Who needs a push?</h3>
          <span className="text-xs text-zinc-500">closest to done first</span>
        </div>
      </div>
      <ul>
        {ranked.map(({ entry, reason }) => (
          <li key={entry.user.id}>
            <button
              onClick={() => onCallOut(entry.user)}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/50 active:bg-zinc-700/50 transition-colors border-b border-zinc-800 last:border-b-0 text-left ${URGENCY_ACCENT[reason.urgency]}`}
            >
              <Avatar name={entry.user.displayName} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {entry.user.displayName}
                </p>
                <p className={`text-xs ${TONE_CLASS[reason.tone]}`}>
                  {reason.text}
                </p>
                {reason.secondary && (
                  <p className="text-[11px] text-zinc-500 truncate">{reason.secondary}</p>
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
