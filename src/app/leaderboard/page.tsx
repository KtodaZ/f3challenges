'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { getCurrentChallenge, getTodayPT, getDayNumber, getTotalDays, getChallengeDates } from '@/lib/challenges'
import { getAllUsers, getUserChallengeLogs, getChallengeParticipants, getDailyLog } from '@/lib/firestore'
import { monthProgress, cn } from '@/lib/utils'
import { LeaderboardRow } from '@/components/leaderboard/LeaderboardRow'
import { GroupStats } from '@/components/leaderboard/GroupStats'
import { CallOutCard } from '@/components/leaderboard/CallOutCard'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { LeaderboardEntry, DailyLog, ChallengeParticipation, User } from '@/types'

export default function LeaderboardPage() {
  const { currentUser, allUsers } = useUser()
  const router = useRouter()
  const challenge = getCurrentChallenge()

  const [entries, setEntries]   = useState<LeaderboardEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadData = useCallback(async () => {
    if (!challenge || allUsers.length === 0) { setLoading(false); return }

    const today = getTodayPT()

    const [participations, allTodayLogs] = await Promise.all([
      getChallengeParticipants(challenge.id),
      Promise.all(allUsers.map(u => getDailyLog(u.id, today))),
    ])

    const participationMap = new Map<string, ChallengeParticipation>(
      participations.map(p => [p.userId, p])
    )
    const dayNum = getDayNumber(challenge, today) ?? 1
    const totalDays = getTotalDays(challenge)
    const challengeDates = getChallengeDates(challenge)
    const pastDates = challengeDates.filter(d => d <= today)

    const entriesData = await Promise.all(
      allUsers.map(async (user, idx) => {
        const logs       = await getUserChallengeLogs(user.id, challenge.id)
        const todayLog   = allTodayLogs[idx]
        const part       = participationMap.get(user.id)

        const completedDays = logs.filter(l => l.completionFraction >= 0.25).length
        const completionPct = pastDates.length > 0
          ? Math.round((completedDays / pastDates.length) * 100)
          : 0

        // Compute streak — don't dock mid-day, start from yesterday if today isn't done
        const completedSet = new Set(
          logs.filter(l => l.completionFraction >= 0.25).map(l => l.date)
        )
        const todayDone = completedSet.has(today)
        let streakCheck = todayDone
          ? today
          : (() => {
              const d = new Date(today + 'T00:00:00')
              d.setDate(d.getDate() - 1)
              return d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
            })()
        let streak = 0
        while (completedSet.has(streakCheck)) {
          streak++
          const d = new Date(streakCheck + 'T00:00:00')
          d.setDate(d.getDate() - 1)
          streakCheck = d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
        }

        return {
          user,
          participation: part,
          completedDays,
          totalDays: pastDates.length,
          completionPct,
          currentStreak: streak,
          todayComplete: (todayLog?.completionFraction ?? 0) >= 1,
          todayLog: todayLog ?? undefined,
        } satisfies LeaderboardEntry
      })
    )

    // Sort: opted-out last, then by completionPct desc, streak as tiebreaker
    entriesData.sort((a, b) => {
      const aOut = a.participation?.status === 'opted-out'
      const bOut = b.participation?.status === 'opted-out'
      if (aOut !== bOut) return aOut ? 1 : -1
      if (b.completionPct !== a.completionPct) return b.completionPct - a.completionPct
      return b.currentStreak - a.currentStreak
    })

    setEntries(entriesData)
    setLoading(false)
    setRefreshing(false)
  }, [challenge, allUsers])

  useEffect(() => { loadData() }, [loadData])

  async function handleRefresh() {
    setRefreshing(true)
    await loadData()
  }

  if (!challenge) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <p className="text-zinc-500">No active challenge right now.</p>
      </div>
    )
  }

  const todayStr  = getTodayPT()
  const dayNum    = getDayNumber(challenge, todayStr) ?? 1
  const totalDays = getTotalDays(challenge)
  const progress  = monthProgress(challenge.startDate, challenge.endDate)
  const completedToday = entries.filter(e => e.todayComplete).length
  const needsPush = entries.filter(e => !e.todayComplete && e.participation?.status !== 'opted-out')

  return (
    <div className="pb-nav">
      {/* Header */}
      <div className="px-4 pt-12 pb-4 bg-zinc-950 border-b border-zinc-800 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-lg font-bold text-white">Leaderboard</h1>
            <p className="text-xs text-zinc-500">{challenge.name}</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-xs text-zinc-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-zinc-800 disabled:opacity-50"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        <ProgressBar
          value={progress}
          label={`Day ${dayNum} of ${totalDays}`}
          sublabel={`${completedToday} of ${entries.length} done today`}
          className="mt-2"
        />
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Group stats */}
        {!loading && entries.length > 0 && <GroupStats entries={entries} />}

        {/* Leaderboard rows */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-4 border-b border-zinc-800/60 last:border-0 animate-pulse">
                <div className="w-6 h-4 bg-zinc-800 rounded" />
                <div className="w-10 h-10 bg-zinc-800 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-zinc-800 rounded w-32" />
                  <div className="h-2.5 bg-zinc-800 rounded w-20" />
                </div>
                <div className="w-10 h-6 bg-zinc-800 rounded" />
              </div>
            ))
          ) : entries.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-sm">No participants yet</div>
          ) : (
            entries.map((entry, idx) => (
              <LeaderboardRow
                key={entry.user.id}
                entry={entry}
                rank={idx + 1}
                isCurrentUser={entry.user.id === currentUser?.id}
                onClick={() => router.push(`/profile/${entry.user.id}`)}
              />
            ))
          )}
        </div>

        {/* Call-out section */}
        {!loading && needsPush.length > 0 && (
          <CallOutCard entries={needsPush} />
        )}
      </div>
    </div>
  )
}
