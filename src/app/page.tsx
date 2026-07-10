'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'
import {
  subscribeToDailyLog,
  upsertDailyLog,
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
  setBadge,
  getBonusLog,
  upsertBonusLog,
  bonusLogId,
  subscribeToWeekBonusLogs,
} from '@/lib/firestore'
import {
  getCurrentChallenge,
  getDailyTarget,
  getTodayPT,
  getDayNumber,
  getTotalDays,
  getMilestoneDays,
  getRequiredDays,
  isRestDay,
  conditionalRestApplies,
  getChallengeDates,
  getCurrentBonusWeek,
  getBonusWeekFeedPost,
  CHALLENGES,
  buildFeedPost,
} from '@/lib/challenges'
import type { FeedPostVars } from '@/lib/challenges'
import { monthProgress, cn, stripUndefined, extractHashtags, calculateStreak, isChallengeParticipant } from '@/lib/utils'
import { toast } from 'sonner'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { DailyLogCard } from '@/components/daily/DailyLogCard'
import { WelcomeMessage } from '@/components/home/WelcomeMessage'
import { BonusChallengeCard } from '@/components/home/BonusChallengeCard'
import { DailyExerciseCard } from '@/components/daily/DailyExerciseCard'
import { LogDayModal } from '@/components/daily/LogDayModal'
import { MakeupDayPicker } from '@/components/daily/MakeupDayPicker'
import { MakeupBonusPicker } from '@/components/daily/MakeupBonusPicker'
import type { MissedBonusWeek } from '@/components/daily/MakeupBonusPicker'
import { CalloutModal } from '@/components/daily/CalloutModal'
import { CelebrationModal } from '@/components/ui/CelebrationModal'
import { CelebrationOverlay } from '@/components/ui/CelebrationOverlay'
import type { CelebrationContent } from '@/components/ui/CelebrationOverlay'
import { NextBadgeCard } from '@/components/home/NextBadgeCard'
import { useAchievementEngine } from '@/hooks/useAchievementEngine'
import {
  buildMilestoneCelebration,
  buildRedemptionCelebration,
  buildDebtFreeCelebration,
  buildUnlockCelebration,
  buildMultiUnlockCelebration,
} from '@/lib/celebrations'
import type {
  User,
  DailyLog,
  ChallengeParticipation,
  CompletionFraction,
  ExerciseLog,
  AchievementBadge,
  AchievementDefinition,
  ChallengeTemplate,
  ChallengeTemplateCopy,
  BonusLog,
} from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildDailyCompleteMessage(
  challenge: ChallengeTemplate,
  name: string,
  day: number,
  totalReps: number,
  exerciseCount: number,
  isMakeUp: boolean,
): string {
  const totalDays = getTotalDays(challenge)
  const { quarter: quarterDay, half: halfDay, threeQuarter: threeQuarterDay } = getMilestoneDays(challenge)

  type FeedSection = keyof NonNullable<ChallengeTemplateCopy['feedPost']>
  let section: FeedSection
  if (!isMakeUp && day === 1) section = 'day1'
  else if (!isMakeUp && day === quarterDay) section = 'quarter'
  else if (!isMakeUp && day === halfDay) section = 'half'
  else if (!isMakeUp && day === threeQuarterDay) section = 'threeQuarter'
  else if (isMakeUp) section = 'makeUp'
  else if (day > totalDays / 2) section = 'regularLate'
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
  }

  return buildFeedPost(challenge, section, vars)
}

function snapFraction(val: number): CompletionFraction {
  if (val >= 1)    return 1
  if (val >= 0.75) return 0.75
  if (val >= 0.5)  return 0.5
  if (val >= 0.25) return 0.25
  return 0
}

function computeOverallFraction(
  repsMap: Record<string, number>,
  exercises: Array<{ exercise: { id: string }, reps: number }>
): CompletionFraction {
  if (exercises.length === 0) return 0
  const sum = exercises.reduce((acc, { exercise, reps }) => {
    const completed = repsMap[exercise.id] ?? 0
    return acc + (reps > 0 ? Math.min(completed / reps, 1) : 0)
  }, 0)
  return snapFraction(sum / exercises.length)
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
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-6 text-center gap-4">
      <div className="text-5xl">🏋️</div>
      <h1 className="text-2xl font-bold text-white">No Active Challenge</h1>
      <p className="text-zinc-400 text-sm max-w-xs">
        There&apos;s no challenge running right now. Check back soon — the next one will be here before you know it.
      </p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter()
  const { currentUser, allUsers, loading: userLoading } = useUser()

  const today = getTodayPT()
  const challenge = getCurrentChallenge()

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

  // Modal state
  const [logModalOpen, setLogModalOpen] = useState(false)
  const [calloutOpen, setCalloutOpen] = useState(false)

  // Pre-fill callout modal with a specific target user
  const [calloutTarget, setCalloutTarget] = useState<User | null>(null)
  const [calloutDefaultContent, setCalloutDefaultContent] = useState<string | undefined>(undefined)

  // Saving state for quick-tap debounce
  const [quickSaving, setQuickSaving] = useState(false)

  // Group logs for today (all PAX)
  const [groupLogs, setGroupLogs] = useState<DailyLog[]>([])

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
    const ended = CHALLENGES.filter(c => c.endDate < today)
    if (ended.length === 0) return
    Promise.all(
      ended.map(c => getUserChallengeLogs(currentUser.id, c.id).then(logs => ({ id: c.id, logs })))
    ).then(results => {
      const map: Record<string, DailyLog[]> = {}
      for (const { id, logs } of results) map[id] = logs
      setPastChallengeLogs(map)
    })
  }, [currentUser?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Load challenge roster (participation statuses + who has logged) ──────

  useEffect(() => {
    if (!challenge || allUsers.length === 0) return
    let cancelled = false
    Promise.all([
      getChallengeParticipants(challenge.id),
      getUsersWithChallengeLogs(challenge.id, allUsers.map(u => u.id)),
    ]).then(([participations, loggedUserIds]) => {
      if (cancelled) return
      setRoster({
        statusByUserId: new Map(participations.map(p => [p.userId, p.status])),
        loggedUserIds,
      })
    })
    return () => { cancelled = true }
  }, [challenge, allUsers])

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
      isMakeUp: boolean
    ) => {
      if (!currentUser || !challenge) return

      const target = getDailyTarget(challenge, date)
      if (!target) return

      const overallFraction = computeOverallFraction(exerciseReps, target.exercises)

      const exerciseLogs: ExerciseLog[] = target.exercises.map(({ exercise, reps }) => ({
        exerciseId: exercise.id,
        targetReps: reps,
        completedReps: exerciseReps[exercise.id] ?? 0,
      }))

      const existingLog = allLogs.find(l => l.date === date) ?? (date === today ? todayLog : null)

      const log: DailyLog = {
        id: dailyLogId(currentUser.id, date),
        userId: currentUser.id,
        challengeId: challenge.id,
        date,
        completionFraction: overallFraction,
        exerciseLogs,
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

      // Daily completion feed post
      const wasComplete = !!(existingLog && existingLog.completionFraction >= 1)
      if (overallFraction >= 1 && !wasComplete) {
        const dayNum = getDayNumber(challenge, date) ?? 1
        const content = buildDailyCompleteMessage(
          challenge,
          currentUser.displayName,
          dayNum,
          target.totalReps,
          challenge.exercises.length,
          isMakeUp,
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
      if (overallFraction >= 1 && !wasComplete) {
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

      // Monthly completion: award badge + celebrate (first time only) + feed post
      const completedDaysCount = updatedLogs.filter(l => l.completionFraction >= 1).length
      if (completedDaysCount >= getRequiredDays(challenge)) {
        const alreadyHasBadge = currentUser.badges?.some(
          b => b.challengeId === challenge.id && b.type === 'completed'
        )
        if (!alreadyHasBadge && !celebrationFiredRef.current) {
          celebrationFiredRef.current = true
          const badge: AchievementBadge = {
            challengeId: challenge.id,
            type: 'completed',
            awardedAt: new Date().toISOString(),
          }
          await setBadge(currentUser.id, badge, currentUser.badges ?? [])
          setCelebrationChallenge(challenge)
          setShowCelebration(true)
        }

        const content = `@${currentUser.displayName} just completed ${challenge.name} — every single day! 🏆 ${challenge.hashtag}`
        await createFeedPostOnce(stripUndefined({
          id: `monthly_complete_${currentUser.id}_${challenge.id}`,
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
    [currentUser, challenge, allLogs, todayLog, today, participation, pushCelebrations]
  )

  const saveTodayLog = useCallback(
    (
      repsMap: Record<string, number>,
      notes: string,
      modificationNote: string,
      isMakeUp: boolean
    ) => saveLog(today, repsMap, notes, modificationNote, isMakeUp),
    [saveLog, today]
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

    const fraction = computeOverallFraction(repsMap, target.exercises)
    const exerciseLogs: ExerciseLog[] = target.exercises.map(({ exercise, reps }) => ({
      exerciseId: exercise.id,
      targetReps: reps,
      completedReps: repsMap[exercise.id] ?? 0,
    }))

    const existing = (pastChallengeLogs[pastChallenge.id] ?? []).find(l => l.date === date)
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
      ...(pastChallengeLogs[pastChallenge.id] ?? []).filter(l => l.date !== date),
      newLog,
    ]
    setPastChallengeLogs(prev => ({ ...prev, [pastChallenge.id]: updatedLogs }))

    // Award badge if this makeup completes the challenge
    const completedDays = updatedLogs.filter(l => l.completionFraction >= 1).length
    let completionFired = false
    if (completedDays >= getRequiredDays(pastChallenge)) {
      const alreadyHasBadge = currentUser.badges?.some(
        b => b.challengeId === pastChallenge.id && b.type === 'completed'
      )
      if (!alreadyHasBadge) {
        const badge: AchievementBadge = {
          challengeId: pastChallenge.id,
          type: 'completed',
          awardedAt: new Date().toISOString(),
        }
        await setBadge(currentUser.id, badge, currentUser.badges ?? [])
        setCelebrationChallenge(pastChallenge)
        setShowCelebration(true)
        completionFired = true
      }
    }

    // Redemption moment (skipped when the big completion celebration fires)
    const wasComplete = !!(existing && existing.completionFraction >= 1)
    if (!completionFired && fraction >= 1 && !wasComplete) {
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
  }, [currentUser, pastChallengeLogs, pushCelebrations])

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
  // Makeup: past days with fraction < 1
  const allDates = getChallengeDates(challenge)
  const logsMap  = Object.fromEntries(allLogs.map(l => [l.date, l]))
  const incompletePastDates = allDates.filter(d => {
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

  const hasCatchUp = incompletePastDates.length > 0 || missedBonusWeeks.length > 0

  const todayFraction = todayLog?.completionFraction ?? 0
  const todayLoggedReps = todayLog?.exerciseLogs.reduce((sum, el) => sum + el.completedReps, 0) ?? 0
  const isDayDone     = todayFraction >= 1

  // ── Group PAX stats ──────────────────────────────────────────────────────
  // Only count users participating in this challenge — anyone who has logged a
  // day, explicitly opted in, or (early in the month) hasn't opted out. Keeps
  // inactive month-over-month users out of crew lists and PAX totals.
  const participants = roster
    ? allUsers.filter(u =>
        isChallengeParticipant(
          roster.statusByUserId.get(u.id),
          // The person holding the phone is always "active in the app"
          u.id === currentUser.id || roster.loggedUserIds.has(u.id),
          dayNumber,
        )
      )
    : allUsers // roster still loading — fall back to everyone

  const totalPAX      = participants.length
  const completedCount = groupLogs.filter(l => l.completionFraction >= 1).length
  const activeCount    = groupLogs.filter(l => l.completionFraction > 0 && l.completionFraction < 1).length

  // Users who haven't completed today (for the "push your crew" list)
  const completedTodayIds = new Set(groupLogs.filter(l => l.completionFraction >= 1).map(l => l.userId))
  const incompleteUsers = participants.filter(u => u.id !== currentUser.id && !completedTodayIds.has(u.id))

  const majorityDone = totalPAX > 0 && completedCount / totalPAX > 0.5

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
          <p className="text-zinc-500 text-sm">{challenge.tagline}</p>
        </div>

        {/* ── Monthly progress ── */}
        <ProgressBar
          value={progress}
          label={`Day ${dayNumber} of ${totalDays}`}
          sublabel={`${progress}% through`}
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

        {/* ── PAX completion stat line ── */}
        {totalPAX > 0 && (
          <div className="flex items-center gap-2 px-1">
            <span className="text-sm">💪</span>
            <p className="text-sm text-zinc-400">
              <span className="font-semibold text-zinc-200">{completedCount}/{totalPAX}</span>
              {' '}done
              {activeCount > 0 && (
                <>
                  {' ·'}{' '}
                  <span className="font-semibold text-amber-400">{activeCount}</span>
                  {' '}in progress
                </>
              )}
            </p>
          </div>
        )}

        {/* ── Dynamic welcome message ── */}
        <WelcomeMessage
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
        />

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

        {/* ── Summary log card ── */}
        {!target.isRestDay && (
          <DailyLogCard
            log={todayLog}
            target={target}
            onOpenLog={() => setLogModalOpen(true)}
          />
        )}

        {/* ── Quick-tap exercise cards ── */}
        {!target.isRestDay && !isDayDone && <div className="space-y-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-1">
            Quick Tap
          </p>
          {target.exercises.map(({ exercise, reps }) => (
            <DailyExerciseCard
              key={exercise.id}
              exerciseId={exercise.id}
              name={exercise.name}
              targetReps={reps}
              completedReps={quickReps[exercise.id] ?? 0}
              onChange={handleQuickReps}
              disabled={quickSaving}
              unit={exercise.unit}
            />
          ))}
        </div>}

        {/* ── Next badge: near-miss advertising + Badge of the Month ── */}
        <NextBadgeCard nextUp={nextUp} featured={featuredEval} hasMissedDays={incompletePastDates.length > 0} />

        {/* ── Catch Up: missed days + missed bonus weeks (current challenge) ── */}
        {hasCatchUp && (
          <div className="pt-2 space-y-4">
            <div className="flex items-center gap-2 px-1">
              <span className="text-base">⏳</span>
              <h2 className="text-sm font-bold text-white">Catch Up</h2>
              <span className="text-zinc-500 text-xs">— make up anything you missed</span>
            </div>

            {missedBonusWeeks.length > 0 && challenge.bonusChallenge && (
              <MakeupBonusPicker
                bonusName={challenge.bonusChallenge.name}
                missedWeeks={missedBonusWeeks}
                onComplete={handleBonusMakeup}
                savingWeekStart={bonusMakeupSaving}
              />
            )}

            {incompletePastDates.length > 0 && (
              <MakeupDayPicker
                challenge={challenge}
                incompleteDates={incompletePastDates}
                logs={logsMap}
                onSave={(date, repsMap, notes, modNote, isMakeUp) =>
                  saveLog(date, repsMap, notes, modNote, isMakeUp)
                }
              />
            )}
          </div>
        )}

        {/* ── Makeup section (past challenges) ── */}
        {CHALLENGES.filter(c => c.endDate < today).map(pastChallenge => {
          const logs = pastChallengeLogs[pastChallenge.id] ?? []
          if (logs.length === 0) return null
          if (dismissedMakeups.has(pastChallenge.id)) return null
          const pastLogsMap = Object.fromEntries(logs.map(l => [l.date, l]))
          const incomplete = getChallengeDates(pastChallenge).filter(d => {
            if (isRestDay(pastChallenge, d)) return false
            const log = pastLogsMap[d]
            return !log || log.completionFraction < 1
          })
          if (incomplete.length === 0) return null
          return (
            <div key={pastChallenge.id} className="pt-2">
              <div className="flex items-center justify-between px-1 mb-1">
                <p className="text-xs text-zinc-500">{pastChallenge.name} — missed days</p>
                <button
                  onClick={() => {
                    const next = new Set(dismissedMakeups).add(pastChallenge.id)
                    setDismissedMakeups(next)
                    try { localStorage.setItem('dismissedMakeups', JSON.stringify([...next])) } catch { /* ignore */ }
                  }}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors text-xs"
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
              <MakeupDayPicker
                challenge={pastChallenge}
                incompleteDates={incomplete}
                logs={pastLogsMap}
                onSave={(date, repsMap, notes, modNote) =>
                  savePastChallengeLog(pastChallenge, date, repsMap, notes, modNote)
                }
              />
            </div>
          )
        })}

        {/* ── Celebration banner (shown briefly after completing) ── */}
        {dayJustCompleted && (
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
        {isDayDone && !dayJustCompleted && roster && (
          <div className="rounded-2xl border border-amber-700/50 bg-gradient-to-b from-amber-950/40 to-orange-950/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-amber-300 font-bold text-sm">Push your crew 👊</p>
              {incompleteUsers.length > 0 && (
                <span className="text-xs text-zinc-500">
                  {incompleteUsers.length}/{totalPAX} haven&apos;t finished
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
                The whole crew got it done today — that&apos;s what it&apos;s about. 🏆
              </p>
            )}
          </div>
        )}

        {/* ── Pre-completion motivational nudge ── */}
        {!isDayDone && totalPAX > 0 && (
          <div className="px-1">
            <p className="text-sm text-zinc-500 text-center">
              {majorityDone
                ? `Half the crew is already done — don't get left behind!`
                : `${completedCount > 0 ? completedCount + (completedCount === 1 ? ' PAX has' : ' PAX have') + ' already finished — ' : ''}${totalPAX - completedCount} ${(totalPAX - completedCount) === 1 ? 'PAX is' : 'PAX are'} counting on you — get it done!`
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

      {/* ── Log day modal ── */}
      {!target.isRestDay && (
        <LogDayModal
          open={logModalOpen}
          onClose={() => setLogModalOpen(false)}
          target={target}
          existingLog={todayLog}
          onSave={saveTodayLog}
          isMakeUp={false}
        />
      )}

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
        allUsers={allUsers}
        challengeId={challenge.id}
        defaultTarget={calloutTarget}
        defaultContent={calloutDefaultContent}
      />
    </div>
  )
}
