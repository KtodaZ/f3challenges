'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import type { LeaderboardEntry } from '@/types'

interface GroupStatsProps {
  /** Actual participants only (opted-out / inactive PAX already filtered out). */
  entries: LeaderboardEntry[]
}

export function GroupStats({ entries }: GroupStatsProps) {
  const totalGroupReps = entries.reduce((sum, e) => sum + e.totalReps, 0)

  // Percent-based headline instead of "perfect / no missed days" — 20+ days in,
  // nobody has a spotless record, so a completion average is the useful signal.
  const avgCompletion = entries.length > 0
    ? Math.round(entries.reduce((sum, e) => sum + e.completionPct, 0) / entries.length)
    : 0

  const longestStreak = entries.reduce((max, e) => Math.max(max, e.currentStreak), 0)
  const longestStreakHolder = entries.find(e => e.currentStreak === longestStreak && longestStreak > 0)

  const stats = [
    {
      label: 'Group reps',
      value: totalGroupReps > 0 ? totalGroupReps.toLocaleString() : '0',
      sub: 'total this challenge',
      icon: '💪',
      href: undefined,
    },
    {
      label: 'Avg completion',
      value: `${avgCompletion}%`,
      sub: `across ${entries.length} PAX`,
      icon: '📊',
      href: undefined,
    },
    {
      label: 'Top streak',
      value: longestStreak > 0 ? `${longestStreak}d` : '—',
      sub: longestStreakHolder?.user.displayName ?? 'no one yet',
      icon: '🔥',
      href: longestStreakHolder ? `/profile/${longestStreakHolder.user.id}` : undefined,
    },
  ]

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="grid grid-cols-3 divide-x divide-zinc-800">
        {stats.map(stat => {
          const inner = (
            <div key={stat.label} className="flex flex-col items-center py-3 px-2 gap-0.5">
              <span className="text-lg leading-none mb-0.5">{stat.icon}</span>
              <span className="text-lg font-bold text-white tabular-nums">{stat.value}</span>
              <span className="text-xs text-zinc-400 text-center leading-tight">{stat.label}</span>
              <span className="text-xs text-zinc-600 text-center leading-tight truncate w-full">{stat.sub}</span>
            </div>
          )
          return stat.href ? (
            <Link key={stat.label} href={stat.href} className="hover:bg-zinc-800/50 transition-colors">
              {inner}
            </Link>
          ) : (
            <div key={stat.label}>{inner}</div>
          )
        })}
      </div>
    </Card>
  )
}
