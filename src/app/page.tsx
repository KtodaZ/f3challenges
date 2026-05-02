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
  dailyLogId,
  getUserChallengeLogs,
  updateUser,
  getLogsForDate,
  createFeedPostOnce,
  awardBadge,
  clearPendingCelebration,
} from '@/lib/firestore'
import {
  getCurrentChallenge,
  getDailyTarget,
  getTodayPT,
  getDayNumber,
  getTotalDays,
  getRequiredDays,
  isRestDay,
  conditionalRestApplies,
  getChallengeDates,
  CHALLENGES,
} from '@/lib/challenges'
import { monthProgress, cn, stripUndefined, extractHashtags, calculateStreak } from '@/lib/utils'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { DailyLogCard } from '@/components/daily/DailyLogCard'
import { WelcomeMessage } from '@/components/home/WelcomeMessage'
import { DailyExerciseCard } from '@/components/daily/DailyExerciseCard'
import { LogDayModal } from '@/components/daily/LogDayModal'
import { MakeupDayPicker } from '@/components/daily/MakeupDayPicker'
import { CalloutModal } from '@/components/daily/CalloutModal'
import { CelebrationModal } from '@/components/ui/CelebrationModal'
import type {
  User,
  DailyLog,
  ChallengeParticipation,
  CompletionFraction,
  ExerciseLog,
  AchievementBadge,
  ChallengeTemplate,
} from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function buildDailyCompleteMessage(
  name: string,
  day: number,
  totalDays: number,
  totalReps: number,
  repsPerExercise: number,
  exerciseCount: number,
  hashtag: string,
  isMakeUp: boolean
): string {
  const quarterDay = Math.round(totalDays * 0.25)
  const halfDay = Math.round(totalDays * 0.5)
  const threeQuarterDay = Math.round(totalDays * 0.75)

  if (!isMakeUp && day === 1) {
    return pickRandom([
      `The Gauntlet begins. @${name} posted Day 1 — ${totalReps} reps, no hesitation. Let's go. 🔥 ${hashtag}`,
      `@${name} didn't come to watch. Day 1 of ${totalDays} — ${totalReps} reps on the board. ${hashtag} 💪`,
      `First day, first reps. @${name} opens ${hashtag} the right way — ${totalReps} on the board. 🔥`,
      `@${name} opened the Gauntlet with ${totalReps} reps. Day 1 of ${totalDays}. This is how it's done. 💪 ${hashtag}`,
      `The first rep is always the hardest. @${name} knocked out ${totalReps} of them on Day 1. 🔥 ${hashtag}`,
      `Day 1 of ${totalDays} is in the books for @${name}. ${totalReps} reps — first of many. 💪 ${hashtag}`,
      `@${name} is in — Day 1 starts now. ${totalReps} reps on the board. Who's next? ${hashtag} 🔥`,
    ])
  }

  if (!isMakeUp && day === quarterDay) {
    return pickRandom([
      `One quarter down. @${name} has cleared ${day} of ${totalDays} days — ${totalReps} reps today and no signs of stopping. 💪 ${hashtag}`,
      `25% complete. @${name} is through the first quarter of the Gauntlet — Day ${day} done, ${totalReps} reps. 🔥 ${hashtag}`,
      `@${name} just hit the quarter mark. Day ${day}/${totalDays}, ${totalReps} reps — three-quarters of the Gauntlet still to go. 💪 ${hashtag}`,
      `Through the first quarter and @${name} hasn't blinked. Day ${day}, ${totalReps} reps. ${totalDays - day} days remain. 🔥 ${hashtag}`,
      `@${name} — Day ${day} of ${totalDays} means 25% of the Gauntlet is behind them. ${totalReps} reps down. Who's keeping up? ${hashtag}`,
      `First quarter logged. @${name} with ${totalReps} reps on Day ${day} — looking like this might go all the way. 💪 ${hashtag}`,
    ])
  }

  if (!isMakeUp && day === halfDay) {
    return pickRandom([
      `Halfway. @${name} has reached the midpoint of the Gauntlet — Day ${day}/${totalDays}, ${totalReps} reps. The second half starts now. 🔥 ${hashtag}`,
      `@${name} is exactly halfway through. Day ${day} of ${totalDays} — ${totalReps} reps. You either quit now or you don't. 💪 ${hashtag}`,
      `Day ${day}/${totalDays}. @${name} just crossed the halfway line. ${totalReps} reps. Same distance to go as already covered. 🔥 ${hashtag}`,
      `50% complete. @${name} hit the halfway mark — Day ${day}, ${totalReps} reps. No looking back now. 💪 ${hashtag}`,
      `@${name} punched through the midpoint of ${hashtag}. ${day} down, ${totalDays - day} to go. ${totalReps} reps today — stay hungry.`,
      `The halfway point belongs to @${name}. Day ${day} of ${totalDays} done — ${totalReps} reps, no quit in sight. ${hashtag} 💪`,
    ])
  }

  if (!isMakeUp && day === threeQuarterDay) {
    return pickRandom([
      `@${name} is in the home stretch — Day ${day}/${totalDays}, ${totalReps} reps. 75% through the Gauntlet. Finish what you started. 🔥 ${hashtag}`,
      `Three-quarters done. @${name} just logged Day ${day} — ${totalReps} reps. Only ${totalDays - day} days to a clean finish. 💪 ${hashtag}`,
      `Day ${day} of ${totalDays} and @${name} is still here. ${totalReps} reps at 75% complete. The end is in sight. 🔥 ${hashtag}`,
      `75% done. @${name} — Day ${day}, ${totalReps} reps. One final push to close this out. 💪 ${hashtag}`,
      `@${name} with ${totalReps} reps on Day ${day} — three-quarters of the Gauntlet in the books. Don't stop now. 🔥 ${hashtag}`,
      `Day ${day} of ${totalDays} — @${name} has ${totalDays - day} days left to finish what they started. ${totalReps} reps logged. 💪 ${hashtag}`,
    ])
  }

  if (isMakeUp) {
    return pickRandom([
      `@${name} went back and made up Day ${day} — ${totalReps} reps. No unfinished business. 💪 ${hashtag}`,
      `@${name} circled back to Day ${day} and knocked out ${totalReps} reps. Better late than never. 🔥 ${hashtag}`,
      `Day ${day} wasn't getting left behind — @${name} came back and got it done. ${totalReps} reps. ✅ ${hashtag}`,
      `@${name} didn't let Day ${day} slip — ${totalReps} reps in the books. 🏋️ ${hashtag}`,
      `No gaps — @${name} patched Day ${day} with ${totalReps} reps. ✅ ${hashtag}`,
      `@${name} said Day ${day} doesn't count as a miss. ${totalReps} reps later, they're right. 💪 ${hashtag}`,
      `Make-up day done. @${name} erased the gap — Day ${day}, ${totalReps} reps completed. ${hashtag} ✅`,
      `@${name} went back and knocked out Day ${day}. ${totalReps} reps — late but logged. That's accountability, brother. ${hashtag}`,
      `Miss a day? @${name} doesn't let it slide. Day ${day} backfilled with ${totalReps} reps. ${hashtag}`,
      `@${name} circled back for Day ${day} — ${totalReps} reps posted. The Gauntlet doesn't have an expiration date. ${hashtag}`,
      `Day ${day} wasn't forgotten. @${name} came back for those ${totalReps} reps. No gap in the log. ${hashtag}`,
      `@${name} refused to leave Day ${day} blank. ${totalReps} reps — better late than never, and better late than most. ${hashtag}`,
    ])
  }
  const variants = [
    `@${name} just put in the work — Day ${day}/${totalDays}, ${totalReps} reps done. 💪 ${hashtag}`,
    `@${name} is accelerating — Day ${day}/${totalDays}, ${totalReps} reps down. 🔥 ${hashtag}`,
    `Day ${day} checked. @${name} knocked out ${totalReps} merkins. No days off. 💪 ${hashtag}`,
    `@${name} — Day ${day}/${totalDays}, ${totalReps} reps on the board. 🏋️ ${hashtag}`,
    `${totalReps} merkins. Day ${day}. @${name} checked the box. 💪 ${hashtag}`,
    `@${name} didn't come to play — Day ${day} of the Gauntlet complete. ${totalReps} reps. 💪 ${hashtag}`,
    `Day ${day}/${totalDays} — @${name} put in the work. ${totalReps} reps completed. 💪 ${hashtag}`,
    `@${name} is ${Math.round((day / totalDays) * 100)}% through the Gauntlet. Day ${day} — ${totalReps} reps. 🔥 ${hashtag}`,
    `Day ${day} logged. @${name} earned it — ${totalReps} reps, ${exerciseCount} variations. ${hashtag} 💪`,
    `@${name} put up ${totalReps} reps on Day ${day}. ✅ ${hashtag}`,
    `✅ Day ${day} of ${totalDays} — @${name} cleared ${totalReps} reps. ${hashtag}`,
    `Day ${day}, ${totalReps} reps. @${name} delivered. 💪 ${hashtag}`,
    `@${name} — Day ${day}/${totalDays}, ${totalReps} reps. No days off. 🔥 ${hashtag}`,
    `The Gauntlet asked for ${totalReps} on Day ${day}. @${name} answered. 💪 ${hashtag}`,
    `@${name} — Day ${day} of ${totalDays}. ${totalReps} merkins in the bank. 🏋️ ${hashtag}`,
    `${totalReps} reps. ${exerciseCount} variations. 1 PAX who doesn't quit. @${name}. Day ${day}. 🔥 ${hashtag}`,
    `@${name} coming back strong — Day ${day}, ${totalReps} reps. 💪 ${hashtag}`,
    `@${name} knocked out their reps for Day ${day}. Will you? ${totalReps} on the board. 🔥 ${hashtag}`,
    `Let's go @${name} — Day ${day} done, ${totalReps} reps in the books. 💪 ${hashtag}`,
    `Another one in the bag. @${name} — Day ${day}, ${totalReps} reps. ✅ ${hashtag}`,
    `Day ${day} didn't stand a chance. @${name} — ${totalReps} reps, done. 💪 ${hashtag}`,
    `@${name} making ${totalReps} reps look like a warm-up. Day ${day}. 🔥 ${hashtag}`,
    `Who's next? @${name} just set the pace on Day ${day} — ${totalReps} reps. 🔥 ${hashtag}`,
    `Day ${day} was already on @${name}'s schedule. ${totalReps} reps, no drama. ✅ ${hashtag}`,
    `@${name} just crushed ${totalReps} reps across ${exerciseCount} variations. Day ${day}/${totalDays} in the books. ${hashtag}`,
    `${totalReps} reps. ${exerciseCount} ways to suffer. @${name} didn't blink. Day ${day} done. ${hashtag}`,
    `@${name} checked the box on Day ${day}. ${totalReps} reps, no excuses. Who else is posting today? ${hashtag}`,
    `Day ${day} belongs to @${name}. ${totalReps} reps handled. ${totalDays - day} days left — will you keep pace? ${hashtag}`,
    `@${name} just stacked another ${totalReps} reps on the pile. Day ${day}/${totalDays}. The Gauntlet doesn't care about your feelings. ${hashtag}`,
    `Quiet day for @${name} — only ${totalReps} reps across ${exerciseCount} merkin variations. Casual. ${hashtag}`,
    `@${name} punched Day ${day} in the mouth. ${totalReps} reps down. Your move. ${hashtag}`,
    `The Gauntlet demanded ${totalReps} reps today. @${name} delivered. Day ${day}/${totalDays}. ${hashtag}`,
    `@${name} — Day ${day} complete. ${totalReps} reps, ${exerciseCount} exercises, zero quit. Are you in or are you watching? ${hashtag}`,
    `Another day, another stack. @${name} posted ${totalReps} reps on Day ${day}. ${hashtag}`,
  ]
  if (day > totalDays / 2) {
    variants.push(
      `Getting harder, @${name}? ${totalReps} reps says otherwise. 😏 ${hashtag}`,
      `Day ${day}. ${totalReps} reps. Still looks easy on @${name}. 😏 ${hashtag}`,
      `${totalReps} reps on Day ${day}. Was that supposed to be hard? @${name} didn't notice. 😏 ${hashtag}`,
      `Only ${totalDays - day} days left. @${name} is already bored. ${totalReps} reps. 😏 ${hashtag}`,
      `@${name} on Day ${day} like it's nothing. ${totalReps} reps. The Gauntlet is embarrassed. 😂 ${hashtag}`,
      `The reps keep going up. @${name} keeps not caring. Day ${day}, ${totalReps} done. 😏 ${hashtag}`,
      `Day ${day} of ${totalDays}. @${name} said "is that all?" and logged ${totalReps} reps. 😂 ${hashtag}`,
      `Does @${name} ever stop? Day ${day}, ${totalReps} reps. Apparently not. 😏 ${hashtag}`,
      `Knees weak, arms heavy — @${name} coming through on Day ${day} anyway. ${totalReps} reps. 😂 ${hashtag}`,
      `@${name} could do this in their sleep. Day ${day} knocked out — ${totalReps} reps. 😏 ${hashtag}`,
      `${totalReps} reps and @${name} didn't even break a sweat. Day ${day}. Someone stop them. 😂 ${hashtag}`,
      `@${name} out here doing ${totalReps} reps like it's a warm-up. Somebody tell The Gauntlet to try harder. 😏 ${hashtag}`,
      `Day ${day} and @${name} is still here. ${totalReps} reps. At this point the merkins owe HIM rent. 😂 ${hashtag}`,
      `@${name} with ${totalReps} reps on Day ${day}. If you're not even gonna have the decency to struggle, at least pretend. 😏 ${hashtag}`,
      `${totalReps} reps and @${name} acts like nothing happened. The Gauntlet is starting to take it personally. 😂 ${hashtag}`,
      `Will the real @${name} please stand up? ${totalReps} reps on Day ${day}/${totalDays}. Man refuses to lose. 😏 ${hashtag}`,
      `@${name} posting ${totalReps} reps on Day ${day} with the energy of someone ordering coffee. Does this man even have a heart rate? 😂 ${hashtag}`,
      `Day ${day}. ${totalReps} reps. @${name} could probably do this blindfolded at this point. The Gauntlet is embarrassed. 😏 ${hashtag}`,
      `Somebody check on @${name} — ${totalReps} reps on Day ${day} and not a single complaint. That's not normal behavior. 😂 ${hashtag}`,
    )
  }
  return pickRandom(variants)
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

  // Participation
  const [participation, setParticipation] = useState<ChallengeParticipation | null>(null)

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

  // Challenge completion celebration modal
  const [showCelebration, setShowCelebration] = useState(false)
  const [celebrationChallenge, setCelebrationChallenge] = useState<ChallengeTemplate | null>(null)
  // Prevents double-modal if saveLog is called twice rapidly on the final day
  const celebrationFiredRef = useRef(false)

  // ── Redirect if no user ──────────────────────────────────────────────────

  useEffect(() => {
    if (!userLoading && !currentUser) {
      router.replace('/onboarding')
    }
  }, [userLoading, currentUser, router])

  // ── Show celebration for retroactively awarded badges (backfill) ─────────

  useEffect(() => {
    if (!currentUser?.pendingCelebration) return
    const found = CHALLENGES.find(c => c.id === currentUser.pendingCelebration!.challengeId)
    if (found) {
      setCelebrationChallenge(found)
      setShowCelebration(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.pendingCelebration?.challengeId])

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
      }

      await upsertDailyLog(stripUndefined(log))

      // Update allLogs cache
      const updatedLogs = [...allLogs.filter(l => l.id !== log.id), log]
        .sort((a, b) => a.date.localeCompare(b.date))
      setAllLogs(updatedLogs)

      // Daily completion feed post
      const wasComplete = !!(existingLog && existingLog.completionFraction >= 1)
      if (overallFraction >= 1 && !wasComplete) {
        const dayNum = getDayNumber(challenge, date) ?? 1
        const content = buildDailyCompleteMessage(
          currentUser.displayName,
          dayNum,
          getTotalDays(challenge),
          target.totalReps,
          target.repsPerExercise,
          challenge.exercises.length,
          challenge.hashtag,
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
          await awardBadge(currentUser.id, badge)
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
    [currentUser, challenge, allLogs, todayLog, today]
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

  const todayFraction = todayLog?.completionFraction ?? 0
  const todayLoggedReps = todayLog?.exerciseLogs.reduce((sum, el) => sum + el.completedReps, 0) ?? 0
  const isDayDone     = todayFraction >= 1

  // ── Group PAX stats ──────────────────────────────────────────────────────
  const totalPAX      = allUsers.length
  const completedCount = groupLogs.filter(l => l.completionFraction >= 1).length
  const activeCount    = groupLogs.filter(l => l.completionFraction > 0 && l.completionFraction < 1).length

  // Users who haven't completed today (for the "push your crew" list)
  const loggedUserIds = new Set(groupLogs.filter(l => l.completionFraction >= 1).map(l => l.userId))
  const incompleteUsers = allUsers.filter(u => u.id !== currentUser.id && !loggedUserIds.has(u.id))

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

        {/* ── Makeup section ── */}
        {incompletePastDates.length > 0 && (
          <div className="pt-2">
            <MakeupDayPicker
              challenge={challenge}
              incompleteDates={incompletePastDates}
              logs={logsMap}
              onSave={(date, repsMap, notes, modNote, isMakeUp) =>
                saveLog(date, repsMap, notes, modNote, isMakeUp)
              }
            />
          </div>
        )}

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

        {/* ── Post-completion: encourage your crew ── */}
        {isDayDone && !dayJustCompleted && (
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
          onClose={async () => {
            setShowCelebration(false)
            if (currentUser?.pendingCelebration) {
              await clearPendingCelebration(currentUser.id)
            }
          }}
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
