'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useUser } from '@/contexts/UserContext'
import {
  getTodayPT, getChallengeDates, getCurrentWeekDates,
  getDayNumber, getTotalDays, getWeekProgress, getChallengeWeeks,
  isWeeklyCumulative, allSets, badgeLoad,
} from '@/lib/challenges'
import { useCurrentChallenge } from '@/hooks/useChallenge'
import { useRegion } from '@/contexts/RegionContext'
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
import type {
  LeaderboardEntry, ChallengeParticipation, User, ChallengeTemplate, DailyLog,
  ExerciseLoad, WeekProgress,
} from '@/types'
import { DEFAULT_NOTIFICATION_PREFS } from '@/types'

type Tab = 'week' | 'month' | 'past'
type Scope = 'week' | 'month'

// Per-user aggregate before it's projected into a scope-specific LeaderboardEntry.
// We compute month + week numbers from the same log fetch so switching tabs is
// instant and both boards rank off identical data.
interface RawEntry {
  user: User
  participation?: ChallengeParticipation
  streak: number
  todayComplete: boolean
  todayLog?: DailyLog
  lastActiveDate?: string
  lastShoutoutAt?: string
  hasMonthActivity: boolean
  month: { reps: number; completedDays: number }
  week:  { reps: number; completedDays: number }
  /** Weekly-cumulative only: standing against this week's rep target. */
  weekProgress?: WeekProgress
  load?: ExerciseLoad
}

/** Projects a raw aggregate into a scope-specific leaderboard entry. */
function toEntry(raw: RawEntry, scope: Scope, elapsedDays: number): LeaderboardEntry {
  const s = raw[scope]
  // On a weekly-cumulative challenge "% complete" is share of the week's rep
  // target, not days finished — days aren't a thing you can complete.
  const completionPct = raw.weekProgress
    ? Math.round(raw.weekProgress.fraction * 100)
    : elapsedDays > 0 ? Math.round((s.completedDays / elapsedDays) * 100) : 0
  return {
    user: raw.user,
    participation: raw.participation,
    completedDays: s.completedDays,
    totalDays: elapsedDays,
    completionPct,
    totalReps: s.reps,
    currentStreak: raw.streak,
    todayComplete: raw.todayComplete,
    todayLog: raw.todayLog,
    lastActiveDate: raw.lastActiveDate,
    lastShoutoutAt: raw.lastShoutoutAt,
    week: raw.weekProgress,
    load: raw.load,
  }
}

/** Opted-out last, then reps desc, days desc, streak as tiebreaker. */
function sortEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
  const aOut = a.participation?.status === 'opted-out'
  const bOut = b.participation?.status === 'opted-out'
  if (aOut !== bOut) return aOut ? 1 : -1
  if (b.totalReps !== a.totalReps) return b.totalReps - a.totalReps
  if (b.completedDays !== a.completedDays) return b.completedDays - a.completedDays
  return b.currentStreak - a.currentStreak
}

// ─── Current-challenge leaderboard (week or month scope) ──────────────────────

interface CurrentLeaderboardProps {
  scope: Scope
  challenge: ChallengeTemplate
  participantEntries: LeaderboardEntry[]
  chartDates: string[]
  dayCompletionCounts: Record<string, number>
  dayRepCounts: Record<string, number>
  participantCount: number
  loading: boolean
  currentUserId: string | undefined
  needsPush: LeaderboardEntry[]
  onCallOut: (user: User) => void
}

function CurrentLeaderboard({
  scope,
  challenge,
  participantEntries,
  chartDates,
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
        <GroupStats entries={participantEntries} scope={scope} />
      )}

      {/* Group charts — swipeable: reps, % completion, heatmap */}
      {!loading && participantEntries.length > 0 && (
        <GroupCharts
          challenge={challenge}
          dates={chartDates}
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
  const { currentUser, roster, refreshCurrentUser } = useUser()
  const { regionId } = useRegion()
  const challenge = useCurrentChallenge()

  // Default to the weekly board so mid-month joiners land on the race they can win.
  const [tab, setTab] = useState<Tab>('week')
  const [competitiveModalOpen, setCompetitiveModalOpen] = useState(false)
  const competitivePromptShown = useRef(false)
  const [monthEntries, setMonthEntries] = useState<LeaderboardEntry[]>([])
  const [weekEntries, setWeekEntries] = useState<LeaderboardEntry[]>([])
  const [dayCompletionCounts, setDayCompletionCounts] = useState<Record<string, number>>({})
  const [dayRepCounts, setDayRepCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [calloutTarget, setCalloutTarget] = useState<User | null>(null)

  const loadData = useCallback(async () => {
    // Roster, not the directory: archived PAX don't get leaderboard rows.
    if (!challenge || roster.length === 0) { setLoading(false); return }

    const today = getTodayPT()

    const [participations, allTodayLogs, shoutoutMap] = await Promise.all([
      getChallengeParticipants(challenge.id),
      Promise.all(roster.map(u => getDailyLog(u.id, today))),
      getLatestShoutoutsByUser(regionId),
    ])

    const participationMap = new Map<string, ChallengeParticipation>(
      participations.map(p => [p.userId, p])
    )
    const challengeDates = getChallengeDates(challenge)
    const monthElapsed = challengeDates.filter(d => d <= today).length
    const isWeekly = isWeeklyCumulative(challenge)
    const weekDates = getCurrentWeekDates(challenge, today)
    const weekStart = weekDates[0] ?? today
    const weekElapsed = weekDates.length
    const dayNum = getDayNumber(challenge, today) ?? 1

    // Per-day group aggregates (keyed by date) — restricted to actual
    // participants so a stray one-rep log or an opted-out PAX doesn't skew the
    // charts. The same maps power both the month and week charts; the week view
    // just narrows the x-axis to this week's dates.
    const dayCounts: Record<string, number> = {}
    const repCounts: Record<string, number> = {}

    const rawEntries = await Promise.all(
      roster.map(async (user, idx) => {
        const logs     = await getUserChallengeLogs(user.id, challenge.id)
        const todayLog = allTodayLogs[idx]
        const part     = participationMap.get(user.id)

        const completedLogs = logs.filter(l => l.completionFraction >= 0.25)

        // Month aggregates
        const monthCompletedDays = completedLogs.length
        const monthReps = logs.reduce(
          (sum, l) => sum + l.exerciseLogs.reduce((s, e) => s + e.completedReps, 0),
          0
        )

        // Week aggregates — same math, restricted to this calendar week
        const weekLogs = logs.filter(l => l.date >= weekStart && l.date <= today)
        const weekCompletedDays = weekLogs.filter(l => l.completionFraction >= 0.25).length
        const weekReps = weekLogs.reduce(
          (sum, l) => sum + l.exerciseLogs.reduce((s, e) => s + e.completedReps, 0),
          0
        )

        // Most recent day this PAX actually put up reps — powers the
        // "hasn't done a rep in N days" push-priority signal.
        const activeDates = logs
          .filter(l => l.exerciseLogs.some(e => e.completedReps > 0))
          .map(l => l.date)
        const lastActiveDate = activeDates.length
          ? activeDates.reduce((a, b) => (a > b ? a : b))
          : undefined

        // Only real participants feed the group charts/stats
        const hasMonthActivity = monthCompletedDays > 0 || monthReps > 0
        const isParticipant = isChallengeParticipant(part?.status, hasMonthActivity, dayNum)
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
          streak,
          todayComplete: (todayLog?.completionFraction ?? 0) >= 1,
          todayLog: todayLog ?? undefined,
          lastActiveDate,
          lastShoutoutAt: shoutoutMap.get(user.id),
          hasMonthActivity,
          month: { reps: monthReps, completedDays: monthCompletedDays },
          week:  { reps: weekReps,  completedDays: weekCompletedDays },
          // The challenge's declared week is authoritative for these — it can
          // be shorter than a calendar week at either end of the month.
          weekProgress: isWeekly
            ? getWeekProgress(challenge, today, logs) ?? undefined
            : undefined,
          // The weight they've done the most reps at across the challenge —
          // not the last one they touched, which flip-flopped on every warm-up.
          load: badgeLoad(allSets(logs)),
        } satisfies RawEntry
      })
    )

    const monthSorted = rawEntries.map(r => toEntry(r, 'month', monthElapsed)).sort(sortEntries)
    const weekSorted  = rawEntries.map(r => toEntry(r, 'week',  weekElapsed)).sort(sortEntries)

    setMonthEntries(monthSorted)
    setWeekEntries(weekSorted)
    setDayCompletionCounts(dayCounts)
    setDayRepCounts(repCounts)
    setLoading(false)
    setRefreshing(false)
  }, [challenge, roster, regionId])

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
  const scope: Scope   = tab === 'month' ? 'month' : 'week'
  const scopedEntries  = scope === 'month' ? monthEntries : weekEntries
  const weekDates      = challenge ? getCurrentWeekDates(challenge, todayStr) : []
  const totalWeeks     = challenge ? getChallengeWeeks(challenge).length : 0
  // Any entry's week carries the same week metadata — grab the first available.
  const currentWeek    = weekEntries.find(e => e.week)?.week
  const monthDates     = challenge ? getChallengeDates(challenge).filter(d => d <= todayStr) : []
  const chartDates     = scope === 'month' ? monthDates : weekDates
  // PAX actually participating in this challenge (logged something, opted in,
  // or still in the early-month grace window) — not inactive users. Filter is
  // month-based so the weekly board still lists everyone (a PAX with 0 reps this
  // week can jump the board with a big day), just ranked by this week's reps.
  const participantEntries = scopedEntries.filter(e => {
    const raw = monthEntries.find(m => m.user.id === e.user.id)
    return isChallengeParticipant(e.participation?.status, (raw?.totalReps ?? 0) > 0 || (raw?.completedDays ?? 0) > 0, dayNum)
  })
  const participantCount = participantEntries.length
  // On a weekly-cumulative challenge a skipped day is allowed, so "hasn't
  // finished today" is noise — the roster that matters is who is short of the
  // week's target, and the headline counts weeks hit rather than days done.
  const weeklyScoring    = challenge ? isWeeklyCumulative(challenge) : false
  const completedToday   = weeklyScoring
    ? participantEntries.filter(e => e.week?.isComplete).length
    : participantEntries.filter(e => e.todayComplete).length
  const needsPush        = weeklyScoring
    ? participantEntries.filter(e => e.week && !e.week.isComplete)
    : participantEntries.filter(e => !e.todayComplete)
  const calloutUsers     = participantEntries.map(e => e.user)
  const calloutStatusById = new Map<string, CalloutUserStatus>(
    scopedEntries.map(e => {
      const frac = e.todayLog?.completionFraction ?? 0
      return [e.user.id, frac >= 1 ? 'done' : frac > 0 ? 'started' : 'notStarted']
    })
  )

  const isCurrent = tab === 'week' || tab === 'month'

  return (
    <div className="pb-nav">
      {/* Header */}
      <div className="px-4 pt-12 pb-3 bg-zinc-950 border-b border-zinc-800 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-white">Leaderboard</h1>
            {isCurrent && challenge && (
              <p className="text-xs text-zinc-500">{challenge.name}</p>
            )}
          </div>
          {isCurrent && (
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
            onClick={() => setTab('week')}
            className={cn(
              'flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors',
              tab === 'week' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            This Week
          </button>
          <button
            onClick={() => setTab('month')}
            className={cn(
              'flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors',
              tab === 'month' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
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
            Past
          </button>
        </div>

        {isCurrent && challenge && (
          <ProgressBar
            value={progress}
            label={
              weeklyScoring && currentWeek
                ? `Week ${currentWeek.week.index} of ${totalWeeks}`
                : `Day ${dayNum} of ${totalDays}`
            }
            sublabel={
              weeklyScoring
                ? `${completedToday} of ${participantCount} hit the week`
                : `${completedToday} of ${participantCount} done today`
            }
            className="mt-2"
          />
        )}
      </div>

      {/* Past finishers tab */}
      {tab === 'past' && <PastFinishers />}

      {/* Current leaderboard tab (week or month) */}
      {isCurrent && (
        !challenge ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-zinc-500 text-sm">No active challenge right now.</p>
          </div>
        ) : (
          <CurrentLeaderboard
            scope={scope}
            challenge={challenge}
            participantEntries={participantEntries}
            chartDates={chartDates}
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
