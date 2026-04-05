'use client'

import type { DailyLog, AchievementBadge } from '@/types'

interface CumulativeStatsProps {
  allLogs: DailyLog[]
  badges: AchievementBadge[]
}

export function CumulativeStats({ allLogs, badges }: CumulativeStatsProps) {
  const totalReps = allLogs.reduce((sum, log) => {
    return sum + log.exerciseLogs.reduce((s, e) => s + e.completedReps, 0)
  }, 0)

  const totalDaysCompleted = allLogs.filter(log => log.completionFraction >= 1).length

  const challengesCompleted = badges.filter(b => b.type === 'completed').length
  const challengesParticipated = badges.length

  const stats = [
    { label: 'Total Reps', value: totalReps.toLocaleString(), icon: '💪' },
    { label: 'Days Completed', value: totalDaysCompleted.toLocaleString(), icon: '✅' },
    { label: 'Challenges Won', value: challengesCompleted.toLocaleString(), icon: '🏆' },
    { label: 'Challenges Joined', value: challengesParticipated.toLocaleString(), icon: '🎯' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map(({ label, value, icon }) => (
        <div
          key={label}
          className="bg-zinc-800/60 border border-zinc-700/50 rounded-2xl p-4 flex flex-col gap-1"
        >
          <span className="text-xl">{icon}</span>
          <span className="text-2xl font-bold text-white">{value}</span>
          <span className="text-xs text-zinc-500 font-medium">{label}</span>
        </div>
      ))}
    </div>
  )
}
