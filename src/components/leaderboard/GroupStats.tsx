'use client'

import { Card } from '@/components/ui/Card'
import type { LeaderboardEntry } from '@/types'

interface GroupStatsProps {
  entries: LeaderboardEntry[]
}

export function GroupStats({ entries }: GroupStatsProps) {
  const activeEntries = entries.filter(
    e => e.participation?.status !== 'opted-out'
  )

  const onStreak = activeEntries.filter(e => e.currentStreak > 0).length

  const totalRepsToday = entries.reduce((sum, e) => {
    if (!e.todayLog) return sum
    return sum + e.todayLog.exerciseLogs.reduce(
      (s, el) => s + el.completedReps,
      0
    )
  }, 0)

  const longestStreak = entries.reduce(
    (max, e) => Math.max(max, e.currentStreak),
    0
  )

  const longestStreakHolder = entries.find(
    e => e.currentStreak === longestStreak && longestStreak > 0
  )

  const stats = [
    {
      label: 'On a streak',
      value: String(onStreak),
      sub: `of ${activeEntries.length} active`,
      icon: '🔥',
    },
    {
      label: 'Reps today',
      value: totalRepsToday > 0 ? totalRepsToday.toLocaleString() : '0',
      sub: 'group total',
      icon: '💪',
    },
    {
      label: 'Top streak',
      value: longestStreak > 0 ? String(longestStreak) : '—',
      sub: longestStreakHolder ? longestStreakHolder.user.displayName : 'no one yet',
      icon: '👑',
    },
  ]

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="grid grid-cols-3 divide-x divide-zinc-800">
        {stats.map(stat => (
          <div key={stat.label} className="flex flex-col items-center py-3 px-2 gap-0.5">
            <span className="text-lg leading-none mb-0.5">{stat.icon}</span>
            <span className="text-lg font-bold text-white">{stat.value}</span>
            <span className="text-xs text-zinc-400 text-center leading-tight">{stat.label}</span>
            <span className="text-xs text-zinc-600 text-center leading-tight truncate w-full text-center">{stat.sub}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
