'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useUser } from '@/contexts/UserContext'
import { getCurrentChallenge, getTodayPT, getChallengeDates, getDayNumber, getTotalDays } from '@/lib/challenges'
import { getUserChallengeLogs, getChallengeParticipants, getDailyLog, getLatestShoutoutsByUser, updateUser } from '@/lib/firestore'
import { monthProgress, cn, isChallengeParticipant } from '@/lib/utils'
import { LeaderboardRow } from '@/components/leaderboard/LeaderboardRow'
import { GroupStats } from '@/components/leaderboard/GroupStats'
import { GroupCharts } from '@/components/leaderboard/GroupCharts'
import { CallOutCard } from '@/components/leaderboard/CallOutCard'
import { CalloutModal, type CalloutUserStatus } from '@/components/daily/CalloutModal'
import { PastFinishers } from '@/components/leaderboard/PastFinishers'
import { CompetitiveOptInModal } from '@/components/notifications/CompetitiveOptIn'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { LeaderboardEntry, ChallengeParticipation, User, ChallengeTemplate } from '@/types'
import { DEFAULT_NOTIFICATION_PREFS } from '@/types'

type Tab = 'current' | 'past'

// ─── Current-month leaderboard ────────────────────────────────────────────────

interface CurrentLeaderboardProps {
  challenge: ChallengeTemplate
  participantEntries: LeaderboardEntry[]
  dayCompletionCounts: Record<string, number>
  dayRepCounts: Record<string, number>
  participantCount: number
  loading: boolean
  currentUserId: string | undefined
  needsPush: LeaderboardEntry[]
  onCallOut: (user: User) => void
}

function CurrentLeaderboard({
  challenge,
  participantEntries,
  dayCompletionCounts,
  dayRepCounts,
  participantCount,
  loading,
  currentUserId,
  needsPush,
  onCallOut,
}: CurrentLeaderboardProps) {
  const router = useRouter()

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Group stats */}
      {!loading && participantEntries.length > 0 && (
        <GroupStats entries={participantEntries} />
      )}

      {/* Group charts — swipeable: reps, % completion, heatmap */}
      {!loading && participantEntries.length > 0 && (
        <GroupCharts
          challenge={challenge}
          dayCompletionCounts={dayCompletionCounts}
          dayRepCounts={dayRepCounts}
          participantCount={participantCount}
        />
      )}

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
        ) : participantEntries.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-sm">No participants yet</div>
        ) : (
          participantEntries.map((entry) => {
            // Dense ranking: first participant sharing this exact sort key
            const denseRank = participantEntries.findIndex(
              e => e.totalReps === entry.totalReps &&
                e.completedDays === entry.completedDays &&
                e.currentStreak === entry.currentStreak
            )
            return (
              <LeaderboardRow
                key={entry.user.id}
                entry={entry}
                rank={denseRank + 1}
                isCurrentUser={entry.user.id === currentUserId}
                onClick={() => router.push(`/profile/${entry.user.id}`)}
              />
            )
          })
        )}
      </div>

      {/* Call-out section */}
      {!loading && needsPush.length > 0 && (
        <CallOutCard entries={needsPush} onCallOut={onCallOut} />
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const { currentUser, allUsers, refreshCurrentUser } = useUser()
  const challenge = getCurrentChallenge()

  const [tab, setTab] = useState<Tab>('current')
  const [competitiveModalOpen, setCompetitiveModalOpen] = useState(false)
  const competitivePromptShown = useRef(false)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [dayCompletionCounts, setDayCompletionCounts] = useState<Record<string, number>>({})
  const [dayRepCounts, setDayRepCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [calloutTarget, setCalloutTarget] = useState<User | null>(null)

  const loadData = useCallback(async () => {
    if (!challenge || allUsers.length === 0) { setLoading(false); return }

    const today = getTodayPT()

    const [participations, allTodayLogs, shoutoutMap] = await Promise.all([
      getChallengeParticipants(challenge.id),
      Promise.all(allUsers.map(u => getDailyLog(u.id, today))),
      getLatestShoutoutsByUser(),
    ])

    const participationMap = new Map<string, ChallengeParticipation>(
      participations.map(p => [p.userId, p])
    )
    const challengeDates = getChallengeDates(challenge)
    const pastDates = challengeDates.filter(d => d <= today)
    const dayNum = getDayNumber(challenge, today) ?? 1

    // Per-day group aggregates — restricted to actual participants so a stray
    // one-rep log or an opted-out PAX doesn't skew the charts.
    const dayCounts: Record<string, number> = {}
    const repCounts: Record<string, number> = {}

    const entriesData = await Promise.all(
      allUsers.map(async (user, idx) => {
        const logs     = await getUserChallengeLogs(user.id, challenge.id)
        const todayLog = allTodayLogs[idx]
        const part     = participationMap.get(user.id)

        const completedLogs = logs.filter(l => l.completionFraction >= 0.25)
        const completedDays = completedLogs.length

        // Most recent day this PAX actually put up reps — powers the
        // "hasn't done a rep in N days" push-priority signal.
        const activeDates = logs
          .filter(l => l.exerciseLogs.some(e => e.completedReps > 0))
          .map(l => l.date)
        const lastActiveDate = activeDates.length
          ? activeDates.reduce((a, b) => (a > b ? a : b))
          : undefined
        const completionPct = pastDates.length > 0
          ? Math.round((completedDays / pastDates.length) * 100)
          : 0
        const totalReps = logs.reduce(
          (sum, l) => sum + l.exerciseLogs.reduce((s, e) => s + e.completedReps, 0),
          0
        )

        // Only real participants feed the group charts/stats
        const isParticipant = isChallengeParticipant(
          part?.status,
          completedDays > 0 || totalReps > 0,
          dayNum,
        )
        if (isParticipant) {
          // Per-day completion counts (heatmap + % completion chart)
          for (const log of completedLogs) {
            dayCounts[log.date] = (dayCounts[log.date] ?? 0) + 1
          }
          // Per-day total reps (reps line chart) — include partial days too
          for (const log of logs) {
            const reps = log.exerciseLogs.reduce((s, e) => s + e.completedReps, 0)
            if (reps > 0) repCounts[log.date] = (repCounts[log.date] ?? 0) + reps
          }
        }

        // Compute streak — don't dock mid-day, start from yesterday if today isn't done
        const completedSet = new Set(completedLogs.map(l => l.date))
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
          totalReps,
          currentStreak: streak,
          todayComplete: (todayLog?.completionFraction ?? 0) >= 1,
          todayLog: todayLog ?? undefined,
          lastActiveDate,
          lastShoutoutAt: shoutoutMap.get(user.id),
        } satisfies LeaderboardEntry
      })
    )

    // Sort: opted-out last, then total reps desc, days desc, streak as tiebreaker
    entriesData.sort((a, b) => {
      const aOut = a.participation?.status === 'opted-out'
      const bOut = b.participation?.status === 'opted-out'
      if (aOut !== bOut) return aOut ? 1 : -1
      if (b.totalReps !== a.totalReps) return b.totalReps - a.totalReps
      if (b.completedDays !== a.completedDays) return b.completedDays - a.completedDays
      return b.currentStreak - a.currentStreak
    })

    setEntries(entriesData)
    setDayCompletionCounts(dayCounts)
    setDayRepCounts(repCounts)
    setLoading(false)
    setRefreshing(false)
  }, [challenge, allUsers])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadData() }, [loadData])

  // First time a PAX lands on the leaderboard without having chosen a
  // competitive-notifications preference, surface the opt-in prompt (once).
  useEffect(() => {
    if (competitivePromptShown.current) return
    if (currentUser && currentUser.notificationPreferences?.competitivePrompted !== true) {
      competitivePromptShown.current = true
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCompetitiveModalOpen(true)
    }
  }, [currentUser])

  async function handleCompetitiveDecide(optIn: boolean) {
    setCompetitiveModalOpen(false)
    if (!currentUser) return
    const base = currentUser.notificationPreferences ?? DEFAULT_NOTIFICATION_PREFS
    const prefs = { ...base, competitive: optIn, competitivePrompted: true }
    try {
      await updateUser(currentUser.id, { notificationPreferences: prefs })
      refreshCurrentUser()
      if (optIn) toast.success('Competitive nudges are on — game on. 🏁')
    } catch {
      toast.error('Could not save your choice')
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    await loadData()
  }

  const todayStr       = getTodayPT()
  const dayNum         = challenge ? getDayNumber(challenge, todayStr) ?? 1 : 1
  const totalDays      = challenge ? getTotalDays(challenge) : 0
  const progress       = challenge ? monthProgress(challenge.startDate, challenge.endDate) : 0
  // PAX actually participating in this challenge (logged something, opted in,
  // or still in the early-month grace window) — not inactive users. Drives the
  // group charts/stats denominators, the nudge list, and the callout roster.
  const participantEntries = entries.filter(e =>
    isChallengeParticipant(e.participation?.status, e.completedDays > 0 || e.totalReps > 0, dayNum)
  )
  const participantCount = participantEntries.length
  const completedToday   = participantEntries.filter(e => e.todayComplete).length
  const needsPush        = participantEntries.filter(e => !e.todayComplete)
  // Roster for the callout modal — same participant filter, so drop-off PAX
  // don't appear in the "Who are you calling out?" list.
  const calloutUsers     = participantEntries.map(e => e.user)
  // Today's progress per PAX — lets the callout modal group by status
  const calloutStatusById = new Map<string, CalloutUserStatus>(
    entries.map(e => {
      const frac = e.todayLog?.completionFraction ?? 0
      return [e.user.id, frac >= 1 ? 'done' : frac > 0 ? 'started' : 'notStarted']
    })
  )

  return (
    <div className="pb-nav">
      {/* Header */}
      <div className="px-4 pt-12 pb-3 bg-zinc-950 border-b border-zinc-800 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-white">Leaderboard</h1>
            {tab === 'current' && challenge && (
              <p className="text-xs text-zinc-500">{challenge.name}</p>
            )}
          </div>
          {tab === 'current' && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-xs text-zinc-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-zinc-800 disabled:opacity-50"
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          )}
        </div>

        {/* Tab toggle */}
        <div className="flex gap-1 bg-zinc-900 rounded-xl p-1">
          <button
            onClick={() => setTab('current')}
            className={cn(
              'flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors',
              tab === 'current' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            This Month
          </button>
          <button
            onClick={() => setTab('past')}
            className={cn(
              'flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors',
              tab === 'past' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            Past Challenges
          </button>
        </div>

        {tab === 'current' && challenge && (
          <ProgressBar
            value={progress}
            label={`Day ${dayNum} of ${totalDays}`}
            sublabel={`${completedToday} of ${participantCount} done today`}
            className="mt-2"
          />
        )}
      </div>

      {/* Past finishers tab */}
      {tab === 'past' && <PastFinishers />}

      {/* Current leaderboard tab */}
      {tab === 'current' && (
        !challenge ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-zinc-500 text-sm">No active challenge right now.</p>
          </div>
        ) : (
          <CurrentLeaderboard
            challenge={challenge}
            participantEntries={participantEntries}
            dayCompletionCounts={dayCompletionCounts}
            dayRepCounts={dayRepCounts}
            participantCount={participantCount}
            loading={loading}
            currentUserId={currentUser?.id}
            needsPush={needsPush}
            onCallOut={setCalloutTarget}
          />
        )
      )}

      {/* Competitive notifications opt-in prompt (first leaderboard visit) */}
      <CompetitiveOptInModal open={competitiveModalOpen} onDecide={handleCompetitiveDecide} />

      {/* Callout modal */}
      {currentUser && challenge && (
        <CalloutModal
          open={calloutTarget !== null}
          onClose={() => setCalloutTarget(null)}
          currentUser={currentUser}
          users={calloutUsers}
          statusByUserId={calloutStatusById}
          challengeId={challenge.id}
          defaultTarget={calloutTarget}
        />
      )}
    </div>
  )
}
