'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'
import {
  subscribeToDailyLog,
  upsertDailyLog,
  clearDailyLogLoad,
  getParticipation,
  upsertParticipation,
  participationId,
  getChallengeParticipants,
  getUsersWithChallengeLogs,
  dailyLogId,
  getUserChallengeLogs,
  updateUser,
  getLogsForDate,
  createFeedPostOnce,
  getBonusLog,
  upsertBonusLog,
  bonusLogId,
  subscribeToWeekBonusLogs,
  getLogsForDateRange,
} from '@/lib/firestore'
import {
  getDailyTarget,
  getTodayPT,
  getDayNumber,
  getTotalDays,
  getMilestoneDays,
  isRestDay,
  conditionalRestApplies,
  getChallengeDates,
  completionContext,
  AWAY_THRESHOLD,
  getCurrentBonusWeek,
  getBonusWeekFeedPost,
  buildFeedPost,
  getRemainingExercises,
  trophyFeedPost,
  isWeeklyCumulative,
  getWeekProgress,
  getChallengeWeeks,
  getChallengeWeek,
  weekCompleteFeedPost,
  getWeekStreak,
  logSets,
  allSets,
  rollupSetReps,
  reconcileSets,
  badgeLoad,
} from '@/lib/challenges'
import type { FeedPostVars } from '@/lib/challenges'
import { monthProgress, cn, stripUndefined, extractHashtags, calculateStreak, isChallengeParticipant } from '@/lib/utils'
import { toast } from 'sonner'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { BonusChallengeCard } from '@/components/home/BonusChallengeCard'
import { TodayStatusCard } from '@/components/daily/TodayStatusCard'
import { WeekProgressCard } from '@/components/daily/WeekProgressCard'
import { AddRepsPad } from '@/components/daily/AddRepsPad'
import { WeekMixLedger } from '@/components/daily/WeekMixLedger'
import { WeekCatchUpCard } from '@/components/daily/WeekCatchUpCard'
import { DayLogCarousel } from '@/components/daily/DayLogCarousel'
import { PastChallengeMakeup, PastWeekCatchUp } from '@/components/daily/PastChallengeMakeup'
import { MakeupBonusPicker } from '@/components/daily/MakeupBonusPicker'
import type { MissedBonusWeek } from '@/components/daily/MakeupBonusPicker'
import { CalloutModal, type CalloutUserStatus } from '@/components/daily/CalloutModal'
import { CelebrationModal } from '@/components/ui/CelebrationModal'
import { CelebrationOverlay } from '@/components/ui/CelebrationOverlay'
import type { CelebrationContent } from '@/components/ui/CelebrationOverlay'
import { NextBadgeCard } from '@/components/home/NextBadgeCard'
import { TrophyTrackCard } from '@/components/home/TrophyTrackCard'
import { syncChallengeTrophy, trophyAmount } from '@/lib/trophies'
import { useAchievementEngine } from '@/hooks/useAchievementEngine'
import { useRegion } from '@/contexts/RegionContext'
import { useCurrentChallenge, usePastChallenges } from '@/hooks/useChallenge'
import {
  buildMilestoneCelebration,
  buildRedemptionCelebration,
  buildDebtFreeCelebration,
  buildUnlockCelebration,
  buildMultiUnlockCelebration,
  buildTrophyCelebration,
  buildWeekCelebration,
} from '@/lib/celebrations'
import type {
  User,
  DailyLog,
  ChallengeParticipation,
  ExerciseLog,
  AchievementDefinition,
  ChallengeTemplate,
  ChallengeTemplateCopy,
  BonusLog,
  TrophyTier,
  ExerciseLoad,
  LoggedSet,
} from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildDailyCompleteMessage(
  challenge: ChallengeTemplate,
  name: string,
  day: number,
  totalReps: number,
  exerciseCount: number,
  isMakeUp: boolean,
  // Full days finished today including this one — 2+ tells the stacked story
  // instead of posting the same "made up a day" line three times in a row.
  stackedDays: number,
  // Required days missed before today; 3+ makes this a comeback post.
  daysAway: number,
): string {
  const totalDays = getTotalDays(challenge)
  const { quarter: quarterDay, half: halfDay, threeQuarter: threeQuarterDay } = getMilestoneDays(challenge)

  type FeedSection = keyof NonNullable<ChallengeTemplateCopy['feedPost']>
  let section: FeedSection
  if (!isMakeUp && day === 1) section = 'day1'
  else if (!isMakeUp && day === quarterDay) section = 'quarter'
  else if (!isMakeUp && day === halfDay) section = 'half'
  else if (!isMakeUp && day === threeQuarterDay) section = 'threeQuarter'
  else if (stackedDays >= 2) section = 'stacked'
  else if (daysAway >= AWAY_THRESHOLD) section = 'comeback'
  else if (isMakeUp) section = 'makeUp'
  else section = 'regular'

  const weekNumber = challenge.weeklyTiers
    ? (challenge.weeklyTiers.findIndex(t => day >= t.startDay && day <= t.endDay) + 1) || undefined
    : undefined

  const vars: FeedPostVars = {
    name,
    day,
    totalDays,
    totalReps,
    exerciseCount,
    hashtag: challenge.hashtag,
    challengeName: challenge.name,
    exerciseName: challenge.exercises[0]?.shortName ?? 'Rep',
    daysLeft: totalDays - day,
    percent: Math.round((day / totalDays) * 100),
    weekNumber,
    stackedDays,
    daysAway,
  }

  return buildFeedPost(challenge, section, vars)
}

// Precise completion: reps done (capped per exercise) over reps targeted.
// Weighting by target amount makes it a true "% of reps done" and stays exact
// at 1 only when every exercise is fully in.
//
// On an open-ended (weekly-cumulative) day there is no daily target to be a
// fraction of, so this collapses to "did you train today" — 1 for any reps at
// all, 0 for none. Week completion is derived from these logs by
// getWeekProgress(); it deliberately does not live on the day.
function computeOverallFraction(
  repsMap: Record<string, number>,
  exercises: Array<{ exercise: { id: string }, reps: number }>,
  isOpenEnded = false,
): number {
  if (isOpenEnded) {
    return Object.values(repsMap).some(n => n > 0) ? 1 : 0
  }
  let done = 0
  let target = 0
  for (const { exercise, reps } of exercises) {
    if (reps <= 0) continue
    done += Math.min(repsMap[exercise.id] ?? 0, reps)
    target += reps
  }
  return target > 0 ? done / target : 0
}

/** Reps banked per exercise across a set of logs. */
function repsByExercise(logs: DailyLog[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const log of logs) {
    for (const el of log.exerciseLogs) {
      map[el.exerciseId] = (map[el.exerciseId] ?? 0) + el.completedReps
    }
  }
  return map
}

// ─── Loading Spinner ──────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-dvh">
      <svg className="animate-spin w-8 h-8 text-orange-500" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  )
}

// ─── No Active Challenge ──────────────────────────────────────────────────────

function NoChallengeView() {
  const { region } = useRegion()
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-6 text-center gap-4">
      <div className="text-5xl">🏋️</div>
      <h1 className="text-2xl font-bold text-white">No Active Challenge</h1>
      <p className="text-zinc-400 text-sm max-w-xs">
        There&apos;s no {region.shortName} challenge running right now. Check back soon — the next one will be here before you know it.
      </p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter()
  // `crewRoster` is the active crew (archived PAX excluded); `allUsers` is
  // the full directory, kept for looking historical names up.
  const { currentUser, allUsers, roster: crewRoster, loading: userLoading, refreshCurrentUser } = useUser()

  const today = getTodayPT()
  const challenge = useCurrentChallenge()
  // Only this region's history — otherwise Sactown PAX get offered makeups
  // for Bedrock challenges they were never part of.
  const pastChallenges = usePastChallenges()

  // Daily log (real-time)
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null)

  // Participation — undefined = not loaded yet, null = loaded and none exists
  const [participation, setParticipation] = useState<ChallengeParticipation | null | undefined>(undefined)

  // Challenge roster: everyone's participation status + who has logged this challenge.
  // null until loaded — crew lists wait for it rather than flashing all users.
  const [roster, setRoster] = useState<{
    statusByUserId: Map<string, ChallengeParticipation['status']>
    loggedUserIds: Set<string>
  } | null>(null)

  // Past challenge logs (for cross-challenge makeup)
  const [pastChallengeLogs, setPastChallengeLogs] = useState<Record<string, DailyLog[]>>({})
  const [dismissedMakeups, setDismissedMakeups] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('dismissedMakeups')
      return new Set(stored ? JSON.parse(stored) : [])
    } catch { return new Set() }
  })

  // Past incomplete logs (for makeup)
  const [allLogs, setAllLogs] = useState<DailyLog[]>([])

  // Exact reps per exercise for quick-tap (mirrors today's log state)
  const [quickReps, setQuickReps] = useState<Record<string, number>>({})

  // Weekly-cumulative additive entry: today's sets, held in a ref as well as
  // state so two taps inside one save round-trip can't clobber each other.
  // Any set can be removed individually, so there's no separate "last add".
  const [todaySets, setTodaySets] = useState<LoggedSet[]>([])
  const weeklySetsRef = useRef<LoggedSet[] | null>(null)

  // Modal state
  const [calloutOpen, setCalloutOpen] = useState(false)

  // Pre-fill callout modal with a specific target user
  const [calloutTarget, setCalloutTarget] = useState<User | null>(null)
  const [calloutDefaultContent, setCalloutDefaultContent] = useState<string | undefined>(undefined)

  // Saving state for quick-tap debounce
  const [quickSaving, setQuickSaving] = useState(false)

  // Group logs for today (all PAX)
  const [groupLogs, setGroupLogs] = useState<DailyLog[]>([])

  // Every PAX's logs for the current week — weekly-cumulative challenges need
  // the whole week to say who's hit the target, which one day can't tell you.
  const [weekGroupLogs, setWeekGroupLogs] = useState<DailyLog[]>([])

  // Celebration banner shown briefly after day completion
  const [dayJustCompleted, setDayJustCompleted] = useState(false)
  const [prevFraction, setPrevFraction] = useState<number>(0)

  // Track which users have been quick-encouraged this session
  const [encouragedIds, setEncouragedIds] = useState<Set<string>>(new Set())

  // Notification setup banner — dismissed for this session
  const [notifBannerDismissed, setNotifBannerDismissed] = useState(false)

  // Bonus challenge
  const [myBonusLog, setMyBonusLog] = useState<BonusLog | null>(null)
  const [weekBonusLogs, setWeekBonusLogs] = useState<BonusLog[]>([])
  const [bonusSaving, setBonusSaving] = useState(false)

  // Bonus makeup (past, ended weeks) — keyed by weekStartDate
  const [pastBonusLogs, setPastBonusLogs] = useState<Record<string, BonusLog | null>>({})
  const [bonusMakeupSaving, setBonusMakeupSaving] = useState<string | null>(null)

  // Challenge completion celebration modal
  const [showCelebration, setShowCelebration] = useState(false)
  const [celebrationChallenge, setCelebrationChallenge] = useState<ChallengeTemplate | null>(null)
  // Prevents double-modal if saveLog is called twice rapidly on the final day
  const celebrationFiredRef = useRef(false)
  // Trophy tiers claimed this session, per challenge — the user-doc refresh is
  // async, so rapid quick-taps would otherwise re-fire a tier that just landed.
  const claimedTrophyRef = useRef<Map<string, TrophyTier>>(new Map())

  // Queue of full-screen dopamine moments (milestones, redemptions, badge
  // unlocks) — shown one at a time, after any challenge-completion modal
  const [celebrationQueue, setCelebrationQueue] = useState<CelebrationContent[]>([])

  const pushCelebrations = useCallback((items: CelebrationContent[], front = false) => {
    setCelebrationQueue(q => (front ? [...items, ...q] : [...q, ...items]))
  }, [])

  // Achievement engine: evaluates the catalog over all the user's logs,
  // awards new badges, and feeds the "next badge" near-miss card
  const featuredBadgeId = challenge?.featuredBadgeId
  const handleUnlocked = useCallback((defs: AchievementDefinition[]) => {
    // A retroactive flood (first run for an existing user) collapses into one modal
    setCelebrationQueue(q => [
      ...q,
      ...(defs.length > 2
        ? [buildMultiUnlockCelebration(defs)]
        : defs.map(d => buildUnlockCelebration(d, d.id === featuredBadgeId))),
    ])
  }, [featuredBadgeId])

  const allUserLogs = useMemo(
    () => [...allLogs, ...Object.values(pastChallengeLogs).flat()],
    [allLogs, pastChallengeLogs]
  )

  const { nextUp, evaluations } = useAchievementEngine({
    logs: allUserLogs,
    challengeId: challenge?.id,
    onUnlocked: handleUnlocked,
  })

  // Badge of the Month — pinned on the Next Badge card until earned
  const featuredEval = useMemo(() => {
    if (!featuredBadgeId) return undefined
    const e = evaluations.find(ev => ev.def.id === featuredBadgeId)
    if (!e || e.progress.earned) return undefined
    if (currentUser?.achievements?.some(a => a.id === featuredBadgeId)) return undefined
    return e
  }, [evaluations, featuredBadgeId, currentUser?.achievements])

  // ── Redirect if no user ──────────────────────────────────────────────────

  useEffect(() => {
    if (!userLoading && !currentUser) {
      router.replace('/onboarding')
    }
  }, [userLoading, currentUser, router])

  // ── Load logs for ended challenges (for makeup across challenge boundaries) ──

  useEffect(() => {
    if (!currentUser) return
    const ended = pastChallenges
    if (ended.length === 0) return
    Promise.all(
      ended.map(c => getUserChallengeLogs(currentUser.id, c.id).then(logs => ({ id: c.id, logs })))
    ).then(results => {
      const map: Record<string, DailyLog[]> = {}
      for (const { id, logs } of results) map[id] = logs
      setPastChallengeLogs(map)
    })
  }, [currentUser?.id, pastChallenges]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Subscribe to today's log ────────────────────────────────────────────

  useEffect(() => {
    if (!currentUser || !challenge) return

    const unsub = subscribeToDailyLog(currentUser.id, today, log => {
      setTodayLog(log)
      if (log) {
        const map: Record<string, number> = {}
        for (const el of log.exerciseLogs) {
          map[el.exerciseId] = el.completedReps
        }
        setQuickReps(map)
        // Seed the additive set list from the server exactly once. After that
        // our own optimistic writes are the truth — re-seeding on every
        // snapshot would let an in-flight save echo back and undo a rapid
        // second tap. `logSets` covers days logged before sets existed.
        if (weeklySetsRef.current === null) {
          const seeded = logSets(log, challenge?.exercises)
          weeklySetsRef.current = seeded
          setTodaySets(seeded)
        }
      }
    })
    return unsub
  }, [currentUser, challenge, today])

  // ── Load participation ───────────────────────────────────────────────────

  useEffect(() => {
    if (!currentUser || !challenge) return
    getParticipation(currentUser.id, challenge.id).then(setParticipation)
  }, [currentUser, challenge])

  // ── Load all challenge logs for makeup picker ───────────────────────────

  useEffect(() => {
    if (!currentUser || !challenge) return
    getUserChallengeLogs(currentUser.id, challenge.id).then(setAllLogs)
  }, [currentUser, challenge])

  // ── Load today's group logs (all PAX) ────────────────────────────────────

  useEffect(() => {
    if (!challenge) return
    getLogsForDate(challenge.id, today).then(setGroupLogs)
  }, [challenge, today])

  // ── Load this week's group logs (weekly-cumulative only) ─────────────────

  useEffect(() => {
    if (!challenge || !isWeeklyCumulative(challenge)) return
    const week = getChallengeWeek(challenge, today)
    if (!week) return
    let cancelled = false
    getLogsForDateRange(challenge.id, week.startDate, week.endDate).then(logs => {
      if (!cancelled) setWeekGroupLogs(logs)
    })
    return () => { cancelled = true }
  }, [challenge, today, todayLog])

  // ── Load challenge roster (participation statuses + who has logged) ──────

  useEffect(() => {
    if (!challenge || crewRoster.length === 0) return
    let cancelled = false
    Promise.all([
      getChallengeParticipants(challenge.id),
      getUsersWithChallengeLogs(challenge.id, crewRoster.map(u => u.id)),
    ]).then(([participations, loggedUserIds]) => {
      if (cancelled) return
      setRoster({
        statusByUserId: new Map(participations.map(p => [p.userId, p.status])),
        loggedUserIds,
      })
    })
    return () => { cancelled = true }
  }, [challenge, crewRoster])

  // ── Bonus challenge: load current user's log + subscribe to week logs ────

  const activeBonusWeek = useMemo(
    () => challenge ? getCurrentBonusWeek(challenge, today) : undefined,
    [challenge, today]
  )

  useEffect(() => {
    setMyBonusLog(null)
    setWeekBonusLogs([])
    if (!currentUser || !challenge || !activeBonusWeek) return
    let cancelled = false
    getBonusLog(challenge.id, activeBonusWeek.startDate, currentUser.id).then(log => {
      if (!cancelled) setMyBonusLog(log)
    })
    const unsub = subscribeToWeekBonusLogs(challenge.id, activeBonusWeek.startDate, setWeekBonusLogs)
    return () => { cancelled = true; unsub() }
  }, [currentUser, challenge, activeBonusWeek])

  // ── Bonus makeup: load this user's logs for past (ended) bonus weeks ──────

  useEffect(() => {
    setPastBonusLogs({})
    if (!currentUser || !challenge?.bonusChallenge) return
    const endedWeeks = challenge.bonusChallenge.weeks.filter(w => w.endDate < today)
    if (endedWeeks.length === 0) return
    let cancelled = false
    Promise.all(
      endedWeeks.map(w =>
        getBonusLog(challenge.id, w.startDate, currentUser.id).then(log => ({ start: w.startDate, log }))
      )
    ).then(results => {
      if (cancelled) return
      const map: Record<string, BonusLog | null> = {}
      for (const { start, log } of results) map[start] = log
      setPastBonusLogs(map)
    })
    return () => { cancelled = true }
  }, [currentUser, challenge, today])

  // ── Celebration banner when user crosses the completion threshold ─────────

  useEffect(() => {
    const currentFraction = todayLog?.completionFraction ?? 0
    if (prevFraction < 1 && currentFraction >= 1) {
      setDayJustCompleted(true)
      const timer = setTimeout(() => setDayJustCompleted(false), 2000)
      return () => clearTimeout(timer)
    }
    setPrevFraction(currentFraction)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayLog?.completionFraction])

  // ── Save a log ──────────────────────────────────────────────────────────

  const saveLog = useCallback(
    async (
      date: string,
      exerciseReps: Record<string, number>,
      notes: string,
      modificationNote: string,
      isMakeUp: boolean,
      /** The day's full set list, when the caller has one (the weekly-cumulative
       *  pad). Everyone else passes reps and lets reconcileSets work it out. */
      sets?: LoggedSet[],
    ) => {
      if (!currentUser || !challenge) return

      const target = getDailyTarget(challenge, date)
      if (!target) return

      const isWeekly = isWeeklyCumulative(challenge)
      const overallFraction = computeOverallFraction(exerciseReps, target.exercises, target.isOpenEnded)

      const exerciseLogs: ExerciseLog[] = target.exercises.map(({ exercise, reps }) => ({
        exerciseId: exercise.id,
        targetReps: reps,
        completedReps: exerciseReps[exercise.id] ?? 0,
      }))

      const existingLog = allLogs.find(l => l.date === date) ?? (date === today ? todayLog : null)

      // Sets are the record of what happened; exerciseLogs and load are rollups
      // of them. Callers that only know rep totals get their sets reconciled
      // here, so the two can never describe different workouts.
      const nextSets = sets ?? reconcileSets(
        exerciseReps,
        existingLog ? logSets(existingLog, challenge.exercises) : [],
        new Date().toISOString(),
      )
      const nextLoad = badgeLoad(nextSets)

      const log: DailyLog = {
        id: dailyLogId(currentUser.id, date),
        userId: currentUser.id,
        challengeId: challenge.id,
        date,
        completionFraction: overallFraction,
        exerciseLogs,
        sets: nextSets,
        load: nextLoad,
        isMakeUp,
        notes: notes || undefined,
        modificationNote: modificationNote || undefined,
        loggedAt: existingLog?.loggedAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // First moment the day hit 100% — powers the first-finisher badges
        completedAt: overallFraction >= 1
          ? existingLog?.completedAt ?? new Date().toISOString()
          : undefined,
      }

      await upsertDailyLog(stripUndefined(log))
      // Omitting `load` above can't remove it — the save merges — so a day whose
      // last weighted set just went away takes a second, explicit write.
      if (!nextLoad && existingLog?.load) await clearDailyLogLoad(log.id)

      // Logging a day opts you into the challenge — create the participation
      // record if none exists yet (undefined = still loading, don't touch it)
      if (participation === null) {
        const now = new Date().toISOString()
        const joined: ChallengeParticipation = {
          id: participationId(currentUser.id, challenge.id),
          userId: currentUser.id,
          challengeId: challenge.id,
          status: 'active',
          joinedAt: now,
          updatedAt: now,
        }
        await upsertParticipation(joined)
        setParticipation(joined)
      }

      // Update allLogs cache
      const updatedLogs = [...allLogs.filter(l => l.id !== log.id), log]
        .sort((a, b) => a.date.localeCompare(b.date))
      setAllLogs(updatedLogs)

      // ── Weekly-cumulative: the week is the thing you complete ──
      // A day-completion post would fire on the first rep of every single day,
      // so these challenges announce the week instead — one post per PAX per
      // week, when they cross the target.
      if (isWeekly) {
        const before = getWeekProgress(challenge, date, allLogs, today)
        const after  = getWeekProgress(challenge, date, updatedLogs, today)
        if (after && after.isComplete && !before?.isComplete) {
          const content = weekCompleteFeedPost({
            name: currentUser.displayName,
            challenge,
            week: after,
            isMakeUp,
          })
          await createFeedPostOnce(stripUndefined({
            id: `week_complete_${currentUser.id}_${after.week.startDate}`,
            type: 'system' as const,
            authorId: 'system',
            content,
            hashtags: extractHashtags(content),
            mentions: [currentUser.id],
            challengeId: challenge.id,
            createdAt: new Date().toISOString(),
            deleted: false,
          }))
          pushCelebrations([buildWeekCelebration(after, challenge.name, isMakeUp)], true)
        }
      }

      // Daily completion feed post (day-scored challenges only)
      const wasComplete = !!(existingLog && existingLog.completionFraction >= 1)
      if (!isWeekly && overallFraction >= 1 && !wasComplete) {
        const dayNum = getDayNumber(challenge, date) ?? 1
        const { stackedDays, daysAway } = completionContext(challenge, updatedLogs, today)
        const content = buildDailyCompleteMessage(
          challenge,
          currentUser.displayName,
          dayNum,
          target.totalReps,
          challenge.exercises.length,
          isMakeUp,
          stackedDays,
          daysAway,
        )
        await createFeedPostOnce(stripUndefined({
          id: `daily_complete_${currentUser.id}_${date}`,
          type: 'system' as const,
          authorId: 'system',
          content,
          hashtags: extractHashtags(content),
          mentions: [currentUser.id],
          challengeId: challenge.id,
          createdAt: new Date().toISOString(),
          deleted: false,
        }))
      }

      // Full-screen dopamine moments: milestone days + makeup redemptions
      if (!isWeekly && overallFraction >= 1 && !wasComplete) {
        const dayNum = getDayNumber(challenge, date) ?? 1
        if (isMakeUp) {
          // Redemption — how many missed days remain after this one?
          const done = new Set(updatedLogs.filter(l => l.completionFraction >= 1).map(l => l.date))
          const remaining = getChallengeDates(challenge).filter(d => {
            if (d >= today) return false
            if (isRestDay(challenge, d)) return false
            if (conditionalRestApplies(challenge, d, [...done])) return false
            return !done.has(d)
          }).length
          pushCelebrations(
            [remaining === 0 ? buildDebtFreeCelebration() : buildRedemptionCelebration(dayNum, remaining)],
            true
          )
        } else {
          const { quarter, half, threeQuarter } = getMilestoneDays(challenge)
          const kind =
            dayNum === quarter ? ('quarter' as const)
            : dayNum === half ? ('half' as const)
            : dayNum === threeQuarter ? ('threeQuarter' as const)
            : null
          if (kind) {
            const seenKey = `milestone_${challenge.id}_${kind}`
            let seen = false
            try { seen = localStorage.getItem(seenKey) === '1' } catch { /* ignore */ }
            if (!seen) {
              try { localStorage.setItem(seenKey, '1') } catch { /* ignore */ }
              const repsBanked = updatedLogs.reduce(
                (s, l) => s + l.exerciseLogs.reduce((a, e) => a + e.completedReps, 0), 0)
              pushCelebrations([
                buildMilestoneCelebration(kind, {
                  repsBanked,
                  daysLeft: getTotalDays(challenge) - dayNum,
                  challengeName: challenge.name,
                }),
              ], true)
            }
          }
        }
      }

      // Trophy tier: 🎖️ → 🥉 50% → 🥈 75% → 🥇 100%. Awarded live and only
      // ever upgraded, so crossing a threshold mid-month claims it right away.
      // The amount is days on day-scored challenges and reps on weekly ones —
      // trophyAmount() is the single place that decides.
      const trophyScore = trophyAmount(challenge, updatedLogs)
      const award = await syncChallengeTrophy(
        currentUser, challenge, trophyScore, claimedTrophyRef.current.get(challenge.id)
      )
      if (award) claimedTrophyRef.current.set(challenge.id, award.tier)
      if (award && award.tier === 'gold' && !celebrationFiredRef.current) {
        celebrationFiredRef.current = true
        setCelebrationChallenge(challenge)
        setShowCelebration(true)
      } else if (award && (award.tier === 'bronze' || award.tier === 'silver')) {
        pushCelebrations([buildTrophyCelebration(award.tier, challenge, trophyScore)])
      }
      if (award) refreshCurrentUser()
      // Every real rung gets announced, not just the finish — the crew should
      // see Bronze and Silver land too. 🎖️ Participant stays quiet: day one
      // already has its own completion post.
      if (award && award.tier !== 'participant') {
        const content = trophyFeedPost({
          userName: currentUser.displayName,
          challenge,
          tier: award.tier,
          completed: trophyScore,
        })
        await createFeedPostOnce(stripUndefined({
          // Gold keeps its original id so historical posts stay deduped.
          id: award.tier === 'gold'
            ? `monthly_complete_${currentUser.id}_${challenge.id}`
            : `trophy_${award.tier}_${currentUser.id}_${challenge.id}`,
          type: 'system' as const,
          authorId: 'system',
          content,
          hashtags: extractHashtags(content),
          mentions: [currentUser.id],
          challengeId: challenge.id,
          createdAt: new Date().toISOString(),
          deleted: false,
        }))
      }

      // Update streak
      const completedDates = [
        ...new Set([
          ...allLogs.filter(l => l.completionFraction >= 1).map(l => l.date),
          ...(overallFraction >= 1 ? [date] : []),
        ]),
      ].sort()

      if (completedDates.length > 0) {
        const fixedRest = challenge.restDates ?? []
        const conditionalRest = (challenge.conditionalRestDates ?? [])
          .filter(cr => conditionalRestApplies(challenge, cr.date, completedDates))
          .map(cr => cr.date)
        const { current: newStreak, longest } = calculateStreak(completedDates, [...fixedRest, ...conditionalRest])
        if (newStreak !== currentUser.currentStreak) {
          await updateUser(currentUser.id, {
            currentStreak: newStreak,
            longestStreak: Math.max(currentUser.longestStreak ?? 0, longest),
          })
        }
      }
    },
    [currentUser, challenge, allLogs, todayLog, today, participation, pushCelebrations, refreshCurrentUser]
  )

  const saveTodayLog = useCallback(
    (
      repsMap: Record<string, number>,
      notes: string,
      modificationNote: string,
      isMakeUp: boolean,
      sets?: LoggedSet[],
    ) => saveLog(today, repsMap, notes, modificationNote, isMakeUp, sets),
    [saveLog, today]
  )

  // ── Weekly-cumulative: additive rep entry ────────────────────────────────
  // Every tap appends a set — reps of one variation at the weight showing on
  // the pad — rather than setting an absolute. The running list is held in a
  // ref as well as state: two taps landing inside one save round-trip must not
  // clobber each other with a stale snapshot.

  const commitSets = useCallback(
    async (next: LoggedSet[]) => {
      weeklySetsRef.current = next
      setTodaySets(next)
      setQuickReps(rollupSetReps(next))
      setQuickSaving(true)
      try {
        await saveTodayLog(
          rollupSetReps(next),
          todayLog?.notes ?? '',
          todayLog?.modificationNote ?? '',
          false,
          next,
        )
      } finally {
        setQuickSaving(false)
      }
    },
    [saveTodayLog, todayLog]
  )

  const handleAddSet = useCallback(
    async (exerciseId: string, reps: number, load?: ExerciseLoad) => {
      if (!challenge || reps <= 0) return
      const base = weeklySetsRef.current ?? todaySets
      await commitSets([
        ...base,
        { exerciseId, reps, ...(load ? { load } : {}), at: new Date().toISOString() },
      ])
    },
    [challenge, commitSets, todaySets]
  )

  /** Removes one set by its timestamp — the pad's per-row ✕. */
  const handleRemoveSet = useCallback(
    async (at: string) => {
      if (!challenge) return
      const base = weeklySetsRef.current ?? todaySets
      const next = base.filter(s => s.at !== at)
      if (next.length === base.length) return
      await commitSets(next)
    },
    [challenge, commitSets, todaySets]
  )

  // ── Weekly-cumulative: top up a week that closed short ───────────────────
  // Reps land on the week's last day and are flagged as a make-up.

  const [weekCatchUpSaving, setWeekCatchUpSaving] = useState<string | null>(null)

  const handleWeekCatchUp = useCallback(
    async (weekEndDate: string, exerciseId: string, reps: number) => {
      if (!challenge) return
      setWeekCatchUpSaving(weekEndDate)
      try {
        const existing = allLogs.find(l => l.date === weekEndDate)
        const base: Record<string, number> = {}
        for (const el of existing?.exerciseLogs ?? []) base[el.exerciseId] = el.completedReps
        await saveLog(
          weekEndDate,
          { ...base, [exerciseId]: (base[exerciseId] ?? 0) + reps },
          existing?.notes ?? '',
          existing?.modificationNote ?? '',
          true,
        )
      } finally {
        setWeekCatchUpSaving(null)
      }
    },
    [challenge, allLogs, saveLog]
  )

  // ── Quick-tap handler (immediate save) ─────────────────────────────────

  const handleQuickReps = useCallback(
    async (exerciseId: string, reps: number) => {
      if (!challenge) return
      const newReps: Record<string, number> = {
        ...quickReps,
        [exerciseId]: reps,
      }
      setQuickReps(newReps)

      if (quickSaving) return
      setQuickSaving(true)
      try {
        await saveTodayLog(newReps, todayLog?.notes ?? '', todayLog?.modificationNote ?? '', false)
      } finally {
        setQuickSaving(false)
      }
    },
    [quickReps, quickSaving, saveTodayLog, todayLog, challenge]
  )

  // ── Quick-tap save for a make-up day (current challenge, no modal) ──────
  // Receives the full reps map for the date so rapid taps can't clobber each
  // other; persists as a make-up log.

  const handleMakeupReps = useCallback(
    async (date: string, repsMap: Record<string, number>) => {
      const existing = allLogs.find(l => l.date === date)
      await saveLog(
        date,
        repsMap,
        existing?.notes ?? '',
        existing?.modificationNote ?? '',
        true,
      )
    },
    [allLogs, saveLog]
  )

  // ── Save a log for a past (ended) challenge ─────────────────────────────

  const savePastChallengeLog = useCallback(async (
    pastChallenge: ChallengeTemplate,
    date: string,
    repsMap: Record<string, number>,
    notes: string,
    modNote: string,
  ) => {
    if (!currentUser) return
    const target = getDailyTarget(pastChallenge, date)
    if (!target) return

    // isOpenEnded matters here too: without it a top-up on a closed weekly
    // challenge divides by a zero target and saves as fraction 0 — logged
    // reps that don't read as a day trained.
    const fraction = computeOverallFraction(repsMap, target.exercises, target.isOpenEnded)
    const exerciseLogs: ExerciseLog[] = target.exercises.map(({ exercise, reps }) => ({
      exerciseId: exercise.id,
      targetReps: reps,
      completedReps: repsMap[exercise.id] ?? 0,
    }))

    const priorLogs = pastChallengeLogs[pastChallenge.id] ?? []
    const existing = priorLogs.find(l => l.date === date)
    const newLog: DailyLog = stripUndefined({
      id: dailyLogId(currentUser.id, date),
      userId: currentUser.id,
      challengeId: pastChallenge.id,
      date,
      completionFraction: fraction,
      exerciseLogs,
      modificationNote: modNote || undefined,
      isMakeUp: true,
      notes: notes || undefined,
      loggedAt: existing?.loggedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: fraction >= 1
        ? existing?.completedAt ?? new Date().toISOString()
        : undefined,
    })

    await upsertDailyLog(newLog)

    const updatedLogs = [
      ...priorLogs.filter(l => l.date !== date),
      newLog,
    ]
    setPastChallengeLogs(prev => ({ ...prev, [pastChallenge.id]: updatedLogs }))

    // A closed challenge is never a closed book — makeup days keep climbing the
    // trophy ladder here exactly like they do on the live challenge.
    const completedDays = trophyAmount(pastChallenge, updatedLogs)
    const award = await syncChallengeTrophy(
      currentUser, pastChallenge, completedDays, claimedTrophyRef.current.get(pastChallenge.id)
    )
    if (award) claimedTrophyRef.current.set(pastChallenge.id, award.tier)
    let trophyMomentFired = false
    if (award?.tier === 'gold') {
      setCelebrationChallenge(pastChallenge)
      setShowCelebration(true)
      trophyMomentFired = true
    } else if (award && (award.tier === 'bronze' || award.tier === 'silver')) {
      pushCelebrations([buildTrophyCelebration(award.tier, pastChallenge, completedDays, true)])
      trophyMomentFired = true
    }
    if (award) refreshCurrentUser()
    if (award && award.tier !== 'participant') {
      const content = trophyFeedPost({
        userName: currentUser.displayName,
        challenge: pastChallenge,
        tier: award.tier,
        completed: completedDays,
      })
      await createFeedPostOnce(stripUndefined({
        id: award.tier === 'gold'
          ? `monthly_complete_${currentUser.id}_${pastChallenge.id}`
          : `trophy_${award.tier}_${currentUser.id}_${pastChallenge.id}`,
        type: 'system' as const,
        authorId: 'system',
        content,
        hashtags: extractHashtags(content),
        mentions: [currentUser.id],
        challengeId: pastChallenge.id,
        createdAt: new Date().toISOString(),
        deleted: false,
      }))
    }

    // Redemption moment (skipped when the big celebration/trophy moment fires)
    const wasComplete = !!(existing && existing.completionFraction >= 1)
    if (!trophyMomentFired && isWeeklyCumulative(pastChallenge)) {
      // No day was ever owed here, so "days still missed" is meaningless — the
      // moment worth marking is a closed week finally getting there.
      const before = getWeekProgress(pastChallenge, date, priorLogs, today)
      const after  = getWeekProgress(pastChallenge, date, updatedLogs, today)
      if (after && after.isComplete && !before?.isComplete) {
        pushCelebrations([buildWeekCelebration(after, pastChallenge.name, true)], true)
      }
    } else if (!trophyMomentFired && fraction >= 1 && !wasComplete) {
      const done = new Set(updatedLogs.filter(l => l.completionFraction >= 1).map(l => l.date))
      const remaining = getChallengeDates(pastChallenge).filter(d =>
        !isRestDay(pastChallenge, d) && !done.has(d)
      ).length
      const dayNum = getDayNumber(pastChallenge, date) ?? 1
      pushCelebrations(
        [remaining === 0 ? buildDebtFreeCelebration() : buildRedemptionCelebration(dayNum, remaining)],
        true
      )
    }
  }, [currentUser, pastChallengeLogs, pushCelebrations, refreshCurrentUser, today])

  // ── Top up a short week on a challenge that already ended ───────────────
  // Same move as handleWeekCatchUp, routed through the past-challenge save so
  // the trophy ladder and celebrations come from that challenge's own logs.

  const [pastWeekSaving, setPastWeekSaving] = useState<string | null>(null)

  const handlePastWeekCatchUp = useCallback(
    async (
      pastChallenge: ChallengeTemplate,
      weekEndDate: string,
      exerciseId: string,
      reps: number,
    ) => {
      setPastWeekSaving(weekEndDate)
      try {
        const existing = (pastChallengeLogs[pastChallenge.id] ?? []).find(l => l.date === weekEndDate)
        const base: Record<string, number> = {}
        for (const el of existing?.exerciseLogs ?? []) base[el.exerciseId] = el.completedReps
        await savePastChallengeLog(
          pastChallenge,
          weekEndDate,
          { ...base, [exerciseId]: (base[exerciseId] ?? 0) + reps },
          existing?.notes ?? '',
          existing?.modificationNote ?? '',
        )
      } finally {
        setPastWeekSaving(null)
      }
    },
    [pastChallengeLogs, savePastChallengeLog]
  )

  // ── Complete bonus challenge for this week ──────────────────────────────

  const handleBonusComplete = useCallback(async () => {
    if (!currentUser || !challenge || !activeBonusWeek || myBonusLog) return
    setBonusSaving(true)
    try {
      const log: BonusLog = {
        id: bonusLogId(challenge.id, activeBonusWeek.startDate, currentUser.id),
        challengeId: challenge.id,
        weekStartDate: activeBonusWeek.startDate,
        userId: currentUser.id,
        completedAt: new Date().toISOString(),
      }
      await upsertBonusLog(log)

      try {
        const content = getBonusWeekFeedPost(
            challenge.bonusChallenge!.name,
            activeBonusWeek,
            challenge.hashtag,
            currentUser.displayName,
          )
        await createFeedPostOnce(stripUndefined({
          id: `bonus_complete_${challenge.id}_${activeBonusWeek.startDate}_${currentUser.id}`,
          type: 'system' as const,
          authorId: 'system',
          content,
          hashtags: extractHashtags(content),
          mentions: [],
          challengeId: challenge.id,
          createdAt: new Date().toISOString(),
          deleted: false,
        }))
      } catch {
        toast.error('Bonus saved, but the feed post failed — try again later')
      }

      setMyBonusLog(log)
    } catch {
      toast.error('Could not save bonus — check your connection and try again')
    } finally {
      setBonusSaving(false)
    }
  }, [currentUser, challenge, activeBonusWeek, myBonusLog])

  // ── Make up a past (ended) bonus week ───────────────────────────────────

  const handleBonusMakeup = useCallback(async (week: { startDate: string; endDate: string; description: string; feedPostTemplates?: string[] }) => {
    if (!currentUser || !challenge?.bonusChallenge) return
    if (pastBonusLogs[week.startDate]) return // already completed
    setBonusMakeupSaving(week.startDate)
    try {
      const log: BonusLog = {
        id: bonusLogId(challenge.id, week.startDate, currentUser.id),
        challengeId: challenge.id,
        weekStartDate: week.startDate,
        userId: currentUser.id,
        completedAt: new Date().toISOString(),
        isMakeUp: true,
      }
      await upsertBonusLog(stripUndefined(log))

      try {
        const content = getBonusWeekFeedPost(
          challenge.bonusChallenge.name,
          week,
          challenge.hashtag,
          currentUser.displayName,
          true, // makeup flavor
        )
        await createFeedPostOnce(stripUndefined({
          id: `bonus_complete_${challenge.id}_${week.startDate}_${currentUser.id}`,
          type: 'system' as const,
          authorId: 'system',
          content,
          hashtags: extractHashtags(content),
          mentions: [],
          challengeId: challenge.id,
          createdAt: new Date().toISOString(),
          deleted: false,
        }))
      } catch {
        toast.error('Bonus saved, but the feed post failed — try again later')
      }

      setPastBonusLogs(prev => ({ ...prev, [week.startDate]: log }))
    } catch {
      toast.error('Could not save bonus — check your connection and try again')
    } finally {
      setBonusMakeupSaving(null)
    }
  }, [currentUser, challenge, pastBonusLogs])

  // ── Rejoin challenge ────────────────────────────────────────────────────

  async function handleRejoin() {
    if (!currentUser || !challenge || !participation) return
    const updated: ChallengeParticipation = stripUndefined({
      ...participation,
      status: 'active',
      optOutReason: undefined,
      updatedAt: new Date().toISOString(),
    })
    await upsertParticipation(updated)
    setParticipation(updated)
  }

  // ─────────────────────────────────────────────────────────────────────────

  // Must be above early returns — hooks can't be called conditionally
  const completedLogDates = useMemo(() =>
    allLogs.filter(l => l.completionFraction >= 1).map(l => l.date).sort()
  , [allLogs])

  const userRestDates = useMemo(() => {
    if (!challenge) return []
    return [
      ...(challenge.restDates ?? []),
      ...(challenge.conditionalRestDates ?? [])
        .filter(cr => conditionalRestApplies(challenge, cr.date, completedLogDates))
        .map(cr => cr.date),
    ]
  }, [challenge, completedLogDates])

  const streak = useMemo(() =>
    calculateStreak(completedLogDates, userRestDates).current
  , [completedLogDates, userRestDates])

  if (userLoading) return <Spinner />
  if (!currentUser) return null // redirect in progress

  if (!challenge) return <NoChallengeView />

  const target = getDailyTarget(challenge, today)
  if (!target) return <NoChallengeView />

  const dayNumber   = getDayNumber(challenge, today) ?? 1
  const totalDays   = getTotalDays(challenge)
  const progress    = monthProgress(challenge.startDate, challenge.endDate)
  const weeklyScoring = isWeeklyCumulative(challenge)

  // ── Weekly-cumulative state ──
  const weekProgress    = weeklyScoring ? getWeekProgress(challenge, today, allLogs) : null
  const challengeWeeks  = weeklyScoring ? getChallengeWeeks(challenge) : []
  const weekStreak      = weeklyScoring ? getWeekStreak(challenge, today, allLogs) : 0
  const weekLogs        = weekProgress
    ? allLogs.filter(l => l.date >= weekProgress.week.startDate && l.date <= weekProgress.week.endDate)
    : []
  const weekMix         = repsByExercise(weekLogs)
  // Every set this week, so the ledger can also break the mix down by weight
  // and total the pounds moved.
  const weekSets        = allSets(weekLogs, challenge?.exercises)
  // Weeks already closed that came up short — topping them up still climbs the
  // trophy ladder, same as making up a day on a day-scored challenge.
  const shortWeeks = weeklyScoring
    ? challengeWeeks
        .filter(w => w.endDate < today)
        .map(w => getWeekProgress(challenge, w.startDate, allLogs, today))
        .filter((w): w is NonNullable<typeof w> => !!w && !w.isComplete)
    : []
  const weeksHit = weeklyScoring
    ? challengeWeeks
        .filter(w => w.startDate <= today)
        .filter(w => getWeekProgress(challenge, w.startDate, allLogs, today)?.isComplete)
        .length
    : 0

  // Makeup: past days with fraction < 1. A weekly-cumulative challenge has no
  // daily obligation, so nothing is ever owed for a specific day — the week is
  // what can fall short, and that's handled by shortWeeks above.
  const allDates = getChallengeDates(challenge)
  const logsMap  = Object.fromEntries(allLogs.map(l => [l.date, l]))
  const incompletePastDates = weeklyScoring ? [] : allDates.filter(d => {
    if (d >= today) return false
    if (isRestDay(challenge, d)) return false
    if (conditionalRestApplies(challenge, d, completedLogDates)) return false
    const log = logsMap[d]
    return !log || log.completionFraction < 1
  })

  // Makeup: past (ended) bonus weeks with no completion logged for this user
  const missedBonusWeeks: MissedBonusWeek[] = (challenge.bonusChallenge?.weeks ?? [])
    .map((week, i) => ({ week, number: i + 1 }))
    .filter(({ week }) =>
      week.endDate < today &&
      week.startDate in pastBonusLogs &&
      !pastBonusLogs[week.startDate]
    )

  // Missed days now live in the swipeable day carousel above — the Catch Up
  // section is only for missed bonus weeks.
  const hasCatchUp = missedBonusWeeks.length > 0

  // What the challenge has asked for so far, in the trophy's own unit — the
  // pace yardstick for the nudge. Days on a day-scored challenge; on a weekly
  // one, the reps every week up to and including this one has demanded.
  const elapsedRequiredDays = weeklyScoring
    ? challengeWeeks.filter(w => w.startDate <= today).reduce((s, w) => s + w.target, 0)
    : allDates.filter(d =>
        d <= today &&
        !isRestDay(challenge, d) &&
        !conditionalRestApplies(challenge, d, completedLogDates)
      ).length

  const todayFraction = todayLog?.completionFraction ?? 0
  const todayLoggedReps = todayLog?.exerciseLogs.reduce((sum, el) => sum + el.completedReps, 0) ?? 0
  // "You're done, go push the crew" — the week's target on a weekly challenge,
  // today's target otherwise.
  const isDayDone     = todayFraction >= 1

  // ── Group PAX stats ──────────────────────────────────────────────────────
  // Only count users participating in this challenge — anyone who has logged a
  // day, explicitly opted in, or (early in the month) hasn't opted out. Keeps
  // inactive month-over-month users out of crew lists and PAX totals.
  const participants = roster
    ? crewRoster.filter(u =>
        isChallengeParticipant(
          roster.statusByUserId.get(u.id),
          // The person holding the phone is always "active in the app"
          u.id === currentUser.id || roster.loggedUserIds.has(u.id),
          dayNumber,
        )
      )
    : crewRoster // participation still loading — fall back to the whole crew

  const totalPAX      = participants.length
  const completedCount = groupLogs.filter(l => l.completionFraction >= 1).length

  // Reps each PAX has banked this week — the "done" test on a weekly challenge.
  const weekRepsByUser = new Map<string, number>()
  for (const log of weekGroupLogs) {
    const reps = log.exerciseLogs.reduce((s, e) => s + e.completedReps, 0)
    weekRepsByUser.set(log.userId, (weekRepsByUser.get(log.userId) ?? 0) + reps)
  }
  const weekTarget = weekProgress?.target ?? 0
  const paxHitWeek = (id: string) => (weekRepsByUser.get(id) ?? 0) >= weekTarget && weekTarget > 0

  // "Done" means hit the week on a weekly challenge, finished today otherwise.
  const weeklyDoneCount = weeklyScoring
    ? participants.filter(u => paxHitWeek(u.id)).length
    : completedCount
  const activeCount = weeklyScoring
    ? groupLogs.filter(l => l.exerciseLogs.some(e => e.completedReps > 0)).length
    : groupLogs.filter(l => l.completionFraction > 0 && l.completionFraction < 1).length

  // Users still short of the goal (for the "push your crew" list)
  const completedTodayIds = new Set(groupLogs.filter(l => l.completionFraction >= 1).map(l => l.userId))
  const incompleteUsers = participants.filter(u =>
    u.id !== currentUser.id && (weeklyScoring ? !paxHitWeek(u.id) : !completedTodayIds.has(u.id))
  )

  // Per-PAX progress — lets the callout modal group by status
  const calloutStatusById = new Map<string, CalloutUserStatus>(
    participants.map(u => {
      if (weeklyScoring) {
        const reps = weekRepsByUser.get(u.id) ?? 0
        return [u.id, paxHitWeek(u.id) ? 'done' : reps > 0 ? 'started' : 'notStarted']
      }
      const frac = groupLogs.find(l => l.userId === u.id)?.completionFraction ?? 0
      return [u.id, frac >= 1 ? 'done' : frac > 0 ? 'started' : 'notStarted']
    })
  )

  const majorityDone = totalPAX > 0 && weeklyDoneCount / totalPAX > 0.5
  const goalMet = weeklyScoring ? !!weekProgress?.isComplete : isDayDone

  // Show notification setup banner when user wants notifications but has no registered device
  const hasNotifPrefsEnabled = !!(
    currentUser.notificationPreferences?.morning?.enabled ||
    currentUser.notificationPreferences?.afternoon?.enabled ||
    currentUser.notificationPreferences?.evening?.enabled ||
    currentUser.notificationPreferences?.weeklyRecap?.enabled ||
    currentUser.notificationPreferences?.mentions
  )
  const showNotifBanner = !notifBannerDismissed && hasNotifPrefsEnabled && !currentUser.fcmTokens?.length

  function openCalloutFor(user: User | null, defaultContent?: string) {
    setCalloutTarget(user)
    setCalloutDefaultContent(defaultContent)
    setCalloutOpen(true)
  }

  return (
    <div className="min-h-dvh bg-[#09090b]">
      <div className="max-w-lg mx-auto px-4 pt-6 pb-nav space-y-4">

        {/* ── Participation status banners ── */}
        {participation?.status === 'opted-out' && (
          <div className="bg-red-900/30 border border-red-800 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-red-400 mt-0.5">⚠️</span>
            <div className="flex-1">
              <p className="text-red-300 text-sm font-medium">
                You&apos;ve opted out
                {participation.optOutReason ? `: ${participation.optOutReason}` : '.'}
              </p>
              <button
                onClick={handleRejoin}
                className="mt-1 text-sm text-orange-400 underline hover:text-orange-300 font-medium"
              >
                Want back in? Rejoin →
              </button>
            </div>
          </div>
        )}
        {participation?.status === 'modifying' && participation.modificationNote && (
          <div className="bg-amber-900/20 border border-amber-800/50 rounded-2xl p-3">
            <p className="text-amber-400 text-sm">
              <span className="font-semibold">Modifying:</span>{' '}
              {participation.modificationNote}
            </p>
          </div>
        )}

        {/* ── Notification setup banner ── */}
        {showNotifBanner && (
          <div className="bg-amber-900/20 border border-amber-700/50 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-amber-400 mt-0.5 text-lg shrink-0">🔔</span>
            <div className="flex-1 min-w-0">
              <p className="text-amber-200 text-sm font-medium">App isn&apos;t fully installed</p>
              <p className="text-amber-400/80 text-xs mt-0.5">Your device isn&apos;t registered to receive push notifications.</p>
              <Link
                href="/settings/notifications/troubleshoot"
                className="mt-2 inline-block text-sm text-orange-400 underline hover:text-orange-300 font-medium"
              >
                Fix this →
              </Link>
            </div>
            <button
              onClick={() => setNotifBannerDismissed(true)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0 mt-0.5"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* ── Challenge header ── */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-400 text-xs font-semibold uppercase tracking-widest">
                {challenge.hashtag}
              </p>
              <h1 className="text-2xl font-extrabold text-white leading-tight">
                {challenge.name}
              </h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Weeks hit — the weekly challenge's real scoreboard. Sits
                  beside the day streak rather than replacing it: the streak
                  still rewards showing up daily, which is the point. */}
              {weeklyScoring && (
                <div className={cn(
                  'flex flex-col items-center justify-center rounded-2xl px-3 py-2',
                  weeksHit > 0 ? 'bg-green-500/15 border border-green-500/30' : 'bg-zinc-900 border border-zinc-800'
                )}>
                  <span className="text-xl leading-none">💪</span>
                  <span className={cn('text-xs font-bold mt-0.5', weeksHit > 0 ? 'text-green-400' : 'text-zinc-500')}>
                    {weeksHit}/{challengeWeeks.length}w
                  </span>
                </div>
              )}
              {/* Streak badge */}
              <div className={cn(
                'flex flex-col items-center justify-center rounded-2xl px-3 py-2',
                streak > 0 ? 'bg-orange-500/15 border border-orange-500/30' : 'bg-zinc-900 border border-zinc-800'
              )}>
                <span className="text-xl leading-none">{streak > 0 ? '🔥' : '💤'}</span>
                <span className={cn('text-xs font-bold mt-0.5', streak > 0 ? 'text-orange-400' : 'text-zinc-500')}>
                  {streak}d
                </span>
              </div>
            </div>
          </div>
          <p className="text-zinc-500 text-sm">{challenge.tagline}</p>
        </div>

        {/* ── Monthly progress ── */}
        <ProgressBar
          value={progress}
          label={`Day ${dayNumber} of ${totalDays}`}
          sublabel={
            weeklyScoring && weekStreak > 1
              ? `${progress}% through · ${weekStreak} weeks in a row`
              : `${progress}% through`
          }
          color="orange"
        />

        {/* ── Bonus challenge card ── */}
        {challenge.bonusChallenge && activeBonusWeek && (
          <BonusChallengeCard
            key={activeBonusWeek.startDate}
            challengeId={challenge.id}
            bonus={challenge.bonusChallenge}
            activeWeek={activeBonusWeek}
            myLog={myBonusLog}
            weekLogs={weekBonusLogs}
            allUsers={allUsers}
            totalPAX={totalPAX}
            onComplete={handleBonusComplete}
            saving={bonusSaving}
          />
        )}

        {/* ── PAX completion stat line ──
              On a weekly challenge "done" means hit the week's target, not
              finished today — a skipped day is allowed, a short week isn't. */}
        {totalPAX > 0 && (
          <div className="flex items-center gap-2 px-1">
            <span className="text-sm">💪</span>
            <p className="text-sm text-zinc-400">
              <span className="font-semibold text-zinc-200">{weeklyDoneCount}/{totalPAX}</span>
              {weeklyScoring ? ' hit the week' : ' done'}
              {activeCount > 0 && (
                <>
                  {' ·'}{' '}
                  <span className="font-semibold text-amber-400">{activeCount}</span>
                  {weeklyScoring ? ' logged today' : ' in progress'}
                </>
              )}
            </p>
          </div>
        )}

        {/* ── Rest day banner (fixed rest day — no log required) ── */}
        {target.isRestDay && (
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 px-4 py-5 flex items-center gap-4">
            <span className="text-3xl shrink-0">🏖️</span>
            <div>
              <p className="text-white font-bold text-base">Rest Day</p>
              <p className="text-zinc-500 text-sm mt-0.5">No workout required today — rest up and come back strong.</p>
            </div>
          </div>
        )}

        {/* ── Conditional rest day notice (only shown when the condition applies for this user) ── */}
        {!target.isRestDay && target.isConditionalRestDay &&
          conditionalRestApplies(challenge, today, completedLogDates) && (
          <div className="rounded-2xl bg-amber-950/30 border border-amber-700/40 px-4 py-3 flex items-start gap-3">
            <span className="text-amber-400 mt-0.5 shrink-0">💡</span>
            <p className="text-amber-300 text-sm">
              <span className="font-semibold">Optional rest day — </span>
              You logged a workout yesterday. Feel free to skip today if you need the recovery.
            </p>
          </div>
        )}

        {/* ── Weekly-cumulative: the week is the unit ──
              One bar you fill over the week, an additive pad to fill it with,
              and a read-out of what the reps were actually made of. No daily
              ring and no fraction buttons — there's no daily target for them
              to be a fraction of. */}
        {weeklyScoring && weekProgress && (
          <>
            <WeekProgressCard
              progress={weekProgress}
              todayReps={todayLoggedReps}
              totalWeeks={challengeWeeks.length}
            />
            <AddRepsPad
              exercises={challenge.exercises}
              todaySets={todaySets}
              onAdd={handleAddSet}
              onRemoveSet={handleRemoveSet}
              disabled={quickSaving}
            />
            <WeekMixLedger
              exercises={challenge.exercises}
              repsByExercise={weekMix}
              sets={weekSets}
            />
            {challenge.guidance && challenge.guidance.length > 0 && (
              <details className="rounded-2xl bg-zinc-900 border border-zinc-800 px-4 py-3">
                <summary className="text-xs font-semibold text-zinc-500 uppercase tracking-wider cursor-pointer list-none flex items-center justify-between">
                  How to run it
                  <span className="text-zinc-600" aria-hidden="true">▾</span>
                </summary>
                <ul className="mt-2.5 space-y-1.5">
                  {challenge.guidance.map(line => (
                    <li key={line} className="text-xs text-zinc-400 leading-relaxed flex gap-2">
                      <span className="text-orange-500/70 shrink-0">•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {shortWeeks.length > 0 && (
              <WeekCatchUpCard
                weeks={shortWeeks}
                exercises={challenge.exercises}
                onAdd={handleWeekCatchUp}
                savingWeek={weekCatchUpSaving}
              />
            )}
          </>
        )}

        {/* ── Today + swipeable make-up days ──
              Today sits on the right (default view); swipe left to quick-tap
              any day still owed. No modal — it's all Quick Tap. */}
        {!weeklyScoring && (!target.isRestDay || incompletePastDates.length > 0) && (
          <DayLogCarousel
            challenge={challenge}
            today={today}
            missedDates={incompletePastDates}
            logsByDate={logsMap}
            includeToday={!target.isRestDay}
            todayHeader={
              <TodayStatusCard
                userName={currentUser.displayName}
                dayNumber={dayNumber}
                totalDays={totalDays}
                totalReps={target.totalReps}
                repsPerExercise={target.repsPerExercise}
                exerciseCount={target.exercises.length}
                completionFraction={todayFraction}
                loggedReps={todayLoggedReps}
                streak={streak}
                completedCount={completedCount}
                totalPAX={totalPAX}
                activeCount={activeCount}
                incompleteNames={incompleteUsers.map(u => u.displayName)}
                remaining={getRemainingExercises(target, todayLog?.exerciseLogs)}
              />
            }
            todayTarget={target}
            todayReps={quickReps}
            onTodayReps={handleQuickReps}
            todaySaving={quickSaving}
            isDayDone={isDayDone}
            onMakeupReps={handleMakeupReps}
          />
        )}

        {/* ── Month trophy: which tier you're holding and what's next ── */}
        <TrophyTrackCard
          challenge={challenge}
          completed={trophyAmount(challenge, allLogs)}
          elapsedRequiredDays={elapsedRequiredDays}
          missedDays={weeklyScoring ? shortWeeks.length : incompletePastDates.length}
          seed={dayNumber}
        />

        {/* ── Next badge: near-miss advertising + Badge of the Month ── */}
        <NextBadgeCard nextUp={nextUp} featured={featuredEval} hasMissedDays={incompletePastDates.length > 0} />

        {/* ── Catch Up: missed bonus weeks (current challenge) ── */}
        {hasCatchUp && (
          <div className="pt-2 space-y-4">
            <div className="flex items-center gap-2 px-1">
              <span className="text-base">⏳</span>
              <h2 className="text-sm font-bold text-white">Catch Up</h2>
              <span className="text-zinc-500 text-xs">— make up a missed bonus week</span>
            </div>

            {missedBonusWeeks.length > 0 && challenge.bonusChallenge && (
              <MakeupBonusPicker
                bonusName={challenge.bonusChallenge.name}
                missedWeeks={missedBonusWeeks}
                onComplete={handleBonusMakeup}
                savingWeekStart={bonusMakeupSaving}
              />
            )}
          </div>
        )}

        {/* ── Makeup section (past challenges) — collapsible, keeps the modal ── */}
        {pastChallenges.map(pastChallenge => {
          const logs = pastChallengeLogs[pastChallenge.id] ?? []
          if (logs.length === 0) return null
          if (dismissedMakeups.has(pastChallenge.id)) return null
          // A weekly-cumulative challenge has no missed *days* to make up — a
          // day you didn't train isn't a hole, and every daily target is 0, so
          // the day picker would list rest days as missed and offer "0 reps"
          // to log against. A week is what falls short there.
          if (isWeeklyCumulative(pastChallenge)) {
            const short = getChallengeWeeks(pastChallenge)
              .map(w => getWeekProgress(pastChallenge, w.startDate, logs, today))
              .filter((w): w is NonNullable<typeof w> => !!w && !w.isComplete)
            if (short.length === 0) return null
            return (
              <div key={pastChallenge.id} className="pt-2">
                <PastWeekCatchUp
                  challenge={pastChallenge}
                  weeks={short}
                  savingWeek={pastWeekSaving}
                  onAdd={(weekEndDate, exerciseId, reps) =>
                    handlePastWeekCatchUp(pastChallenge, weekEndDate, exerciseId, reps)
                  }
                  onDismiss={() => {
                    const next = new Set(dismissedMakeups).add(pastChallenge.id)
                    setDismissedMakeups(next)
                    try { localStorage.setItem('dismissedMakeups', JSON.stringify([...next])) } catch { /* ignore */ }
                  }}
                />
              </div>
            )
          }
          const pastLogsMap = Object.fromEntries(logs.map(l => [l.date, l]))
          const incomplete = getChallengeDates(pastChallenge).filter(d => {
            if (isRestDay(pastChallenge, d)) return false
            const log = pastLogsMap[d]
            return !log || log.completionFraction < 1
          })
          if (incomplete.length === 0) return null
          return (
            <div key={pastChallenge.id} className="pt-2">
              <PastChallengeMakeup
                challenge={pastChallenge}
                incompleteDates={incomplete}
                logs={pastLogsMap}
                onSave={(date, repsMap, notes, modNote) =>
                  savePastChallengeLog(pastChallenge, date, repsMap, notes, modNote)
                }
                onDismiss={() => {
                  const next = new Set(dismissedMakeups).add(pastChallenge.id)
                  setDismissedMakeups(next)
                  try { localStorage.setItem('dismissedMakeups', JSON.stringify([...next])) } catch { /* ignore */ }
                }}
              />
            </div>
          )
        })}

        {/* ── Celebration banner (shown briefly after completing) ──
              Suppressed on weekly challenges: every day with a rep in it hits
              fraction 1 there, so this would fire on the first set of every
              day. Week completion gets the full-screen moment instead. */}
        {dayJustCompleted && !weeklyScoring && (
          <div className="rounded-2xl bg-green-950/60 border border-green-700/60 px-4 py-3 flex items-center gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-green-500/25 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-green-300 font-bold text-sm">Day complete!</p>
          </div>
        )}

        {/* ── Post-completion: encourage your crew (waits for roster so the
              list never flashes non-participants) ── */}
        {goalMet && !dayJustCompleted && roster && (
          <div className="rounded-2xl border border-amber-700/50 bg-gradient-to-b from-amber-950/40 to-orange-950/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-amber-300 font-bold text-sm">Push your crew 👊</p>
              {incompleteUsers.length > 0 && (
                <span className="text-xs text-zinc-500">
                  {incompleteUsers.length}/{totalPAX} {weeklyScoring ? 'still short' : 'haven\u2019t finished'}
                </span>
              )}
            </div>

            {incompleteUsers.length > 0 ? (
              <>
                <div className="space-y-2">
                  {incompleteUsers.map(u => {
                    const sent = encouragedIds.has(u.id)
                    return (
                      <div key={u.id} className="flex items-center gap-3">
                        <Avatar name={u.displayName} size="sm" />
                        <Link
                          href={`/profile/${u.id}`}
                          className="flex-1 text-sm text-zinc-300 font-medium truncate hover:text-orange-400 transition-colors"
                        >
                          {u.displayName}
                        </Link>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => openCalloutFor(u, `Get after it @${u.displayName}! 💪 ${challenge.hashtag}`)}
                            disabled={sent}
                            className={cn(
                              'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors',
                              sent
                                ? 'bg-green-900/30 text-green-400 border-green-700/40 cursor-default'
                                : 'bg-amber-500/15 text-amber-300 border-amber-600/40 hover:bg-amber-500/25'
                            )}
                          >
                            {sent ? '✓ Sent' : '👊 Encourage'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  className="!bg-amber-900/30 !text-amber-200 hover:!bg-amber-900/50 border border-amber-700/40"
                  onClick={() => {
                    const pending = incompleteUsers.filter(u => !encouragedIds.has(u.id))
                    const names = pending.map(u => `@${u.displayName}`).join(', ')
                    const msg = `Let's go ${names}! Get after it! 💪 ${challenge.hashtag}`
                    openCalloutFor(null, msg)
                  }}
                >
                  <span>👊</span>
                  Encourage All
                </Button>
              </>
            ) : (
              <p className="text-sm text-zinc-400">
                The whole crew got it done — that&apos;s what it&apos;s about. 🏆
              </p>
            )}
          </div>
        )}

        {/* ── Pre-completion motivational nudge ── */}
        {!goalMet && totalPAX > 0 && (
          <div className="px-1">
            <p className="text-sm text-zinc-500 text-center">
              {majorityDone
                ? `Half the crew is already done — don't get left behind!`
                : `${weeklyDoneCount > 0 ? weeklyDoneCount + (weeklyDoneCount === 1 ? ' PAX has' : ' PAX have') + (weeklyScoring ? ' already hit the week — ' : ' already finished — ') : ''}${totalPAX - weeklyDoneCount} ${(totalPAX - weeklyDoneCount) === 1 ? 'PAX is' : 'PAX are'} counting on you — get it done!`
              }
            </p>
          </div>
        )}

        {/* ── Call out button ── */}
        <div className="pt-1">
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={() => openCalloutFor(null)}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
            Call Out a PAX
          </Button>
        </div>

      </div>

      {/* ── Challenge completion celebration ── */}
      {showCelebration && celebrationChallenge && (
        <CelebrationModal
          challenge={celebrationChallenge}
          onClose={() => setShowCelebration(false)}
        />
      )}

      {/* ── Queued dopamine moments (milestones, redemptions, badge unlocks) ── */}
      {!showCelebration && celebrationQueue.length > 0 && (
        <CelebrationOverlay
          key={`${celebrationQueue[0].title}_${celebrationQueue.length}`}
          {...celebrationQueue[0]}
          onClose={() => setCelebrationQueue(q => q.slice(1))}
        />
      )}

      {/* ── Callout modal ── */}
      <CalloutModal
        open={calloutOpen}
        onClose={() => {
          setCalloutOpen(false)
          setCalloutTarget(null)
          setCalloutDefaultContent(undefined)
        }}
        onPosted={targetUserId => {
          if (targetUserId) {
            setEncouragedIds(prev => new Set([...prev, targetUserId]))
          }
        }}
        currentUser={currentUser}
        users={participants}
        statusByUserId={calloutStatusById}
        challengeId={challenge.id}
        defaultTarget={calloutTarget}
        defaultContent={calloutDefaultContent}
      />
    </div>
  )
}
