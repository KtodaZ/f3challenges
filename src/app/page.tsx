'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
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
  createFeedPost,
} from '@/lib/firestore'
import {
  getCurrentChallenge,
  getDailyTarget,
  getTodayPT,
  getDayNumber,
  getTotalDays,
  getChallengeDates,
} from '@/lib/challenges'
import { monthProgress, generateId, cn, stripUndefined, extractHashtags, calculateStreak } from '@/lib/utils'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { DailyLogCard } from '@/components/daily/DailyLogCard'
import { WelcomeMessage } from '@/components/home/WelcomeMessage'
import { DailyExerciseCard } from '@/components/daily/DailyExerciseCard'
import { LogDayModal } from '@/components/daily/LogDayModal'
import { MakeupDayPicker } from '@/components/daily/MakeupDayPicker'
import { CalloutModal } from '@/components/daily/CalloutModal'
import type {
  User,
  DailyLog,
  ChallengeParticipation,
  CompletionFraction,
  ExerciseLog,
} from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function snapFraction(val: number): CompletionFraction {
  if (val >= 1)    return 1
  if (val >= 0.75) return 0.75
  if (val >= 0.5)  return 0.5
  if (val >= 0.25) return 0.25
  return 0
}

function computeOverallFraction(
  fractions: Record<string, CompletionFraction>,
  exerciseIds: string[]
): CompletionFraction {
  if (exerciseIds.length === 0) return 0
  const sum = exerciseIds.reduce((acc, id) => acc + (fractions[id] ?? 0), 0)
  return snapFraction(sum / exerciseIds.length)
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

  // Exercise fractions for quick-tap (mirrors today's log state)
  const [quickFractions, setQuickFractions] = useState<Record<string, CompletionFraction>>({})

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

  // ── Redirect if no user ──────────────────────────────────────────────────

  useEffect(() => {
    if (!userLoading && !currentUser) {
      router.replace('/onboarding')
    }
  }, [userLoading, currentUser, router])

  // ── Subscribe to today's log ────────────────────────────────────────────

  useEffect(() => {
    if (!currentUser || !challenge) return

    const unsub = subscribeToDailyLog(currentUser.id, today, log => {
      setTodayLog(log)
      if (log) {
        const map: Record<string, CompletionFraction> = {}
        for (const el of log.exerciseLogs) {
          const f = el.targetReps > 0 ? el.completedReps / el.targetReps : 0
          map[el.exerciseId] = snapFraction(f)
        }
        setQuickFractions(map)
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
      exerciseFractions: Record<string, CompletionFraction>,
      notes: string,
      modificationNote: string,
      isMakeUp: boolean
    ) => {
      if (!currentUser || !challenge) return

      const target = getDailyTarget(challenge, date)
      if (!target) return

      const exerciseIds = target.exercises.map(e => e.exercise.id)
      const overallFraction = computeOverallFraction(exerciseFractions, exerciseIds)

      const exerciseLogs: ExerciseLog[] = target.exercises.map(({ exercise, reps }) => ({
        exerciseId: exercise.id,
        targetReps: reps,
        completedReps: Math.round(reps * (exerciseFractions[exercise.id] ?? 0)),
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
      setAllLogs(prev => {
        const without = prev.filter(l => l.id !== log.id)
        return [...without, log].sort((a, b) => a.date.localeCompare(b.date))
      })

      // Update streak
      const completedDates = [
        ...new Set([
          ...allLogs.filter(l => l.completionFraction >= 1).map(l => l.date),
          ...(overallFraction >= 1 ? [date] : []),
        ]),
      ].sort()

      if (completedDates.length > 0) {
        let streak = 0
        const todayDate = getTodayPT()
        // Don't dock streak mid-day — start from yesterday if today isn't done yet
        const todayDone = completedDates.includes(todayDate)
        let check = todayDone
          ? todayDate
          : (() => {
              const d = new Date(todayDate + 'T00:00:00')
              d.setDate(d.getDate() - 1)
              return d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
            })()

        while (completedDates.includes(check)) {
          streak++
          const d = new Date(check + 'T00:00:00')
          d.setDate(d.getDate() - 1)
          check = d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
        }

        if (streak !== currentUser.currentStreak) {
          await updateUser(currentUser.id, {
            currentStreak: streak,
            longestStreak: Math.max(currentUser.longestStreak ?? 0, streak),
          })
        }
      }
    },
    [currentUser, challenge, allLogs, todayLog, today]
  )

  const saveTodayLog = useCallback(
    (
      fractions: Record<string, CompletionFraction>,
      notes: string,
      modificationNote: string,
      isMakeUp: boolean
    ) => saveLog(today, fractions, notes, modificationNote, isMakeUp),
    [saveLog, today]
  )

  // ── Quick-tap handler (immediate save) ─────────────────────────────────

  const handleQuickFraction = useCallback(
    async (exerciseId: string, fraction: CompletionFraction) => {
      if (!challenge) return
      const newFractions: Record<string, CompletionFraction> = {
        ...quickFractions,
        [exerciseId]: fraction,
      }
      setQuickFractions(newFractions)

      if (quickSaving) return
      setQuickSaving(true)
      try {
        await saveTodayLog(newFractions, todayLog?.notes ?? '', todayLog?.modificationNote ?? '', false)
      } finally {
        setQuickSaving(false)
      }
    },
    [quickFractions, quickSaving, saveTodayLog, todayLog, challenge]
  )

  // ── Rejoin challenge ────────────────────────────────────────────────────

  async function handleRejoin() {
    if (!currentUser || !challenge || !participation) return
    const updated: ChallengeParticipation = {
      ...participation,
      status: 'active',
      optOutReason: undefined,
      updatedAt: new Date().toISOString(),
    }
    await upsertParticipation(updated)
    setParticipation(updated)
  }

  // ─────────────────────────────────────────────────────────────────────────

  // Must be above early returns — hooks can't be called conditionally
  const streak = useMemo(() => {
    const completedDates = allLogs
      .filter(l => l.completionFraction >= 1)
      .map(l => l.date)
      .sort()
    return calculateStreak(completedDates).current
  }, [allLogs])

  if (userLoading) return <Spinner />
  if (!currentUser) return null // redirect in progress

  if (!challenge) return <NoChallengeView />

  const target = getDailyTarget(challenge, today)
  if (!target) return <NoChallengeView />

  const dayNumber   = getDayNumber(challenge, today) ?? 1
  const totalDays   = getTotalDays(challenge)
  const progress    = monthProgress(challenge.startDate, challenge.endDate)
  const exerciseIds = challenge.exercises.map(e => e.id)

  // Makeup: past days with fraction < 1
  const allDates = getChallengeDates(challenge)
  const logsMap  = Object.fromEntries(allLogs.map(l => [l.date, l]))
  const incompletePastDates = allDates.filter(d => {
    if (d >= today) return false
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

  function openCalloutFor(user: User | null, defaultContent?: string) {
    setCalloutTarget(user)
    setCalloutDefaultContent(defaultContent)
    setCalloutOpen(true)
  }

  async function quickEncourage(targets: User[]) {
    if (!currentUser || !challenge) return
    const isAll = targets.length > 1
    const content = isAll
      ? `Let's go PAX! ${targets.length} of us haven't checked in yet — let's get everyone there! 💪 ${challenge.hashtag}`
      : `Get after it @${targets[0].displayName}! 💪 ${challenge.hashtag}`
    const post = stripUndefined({
      id: generateId(),
      type: 'shoutout' as const,
      authorId: currentUser.id,
      content,
      hashtags: extractHashtags(content),
      mentions: targets.map(u => u.id),
      challengeId: challenge.id,
      targetUserId: targets.length === 1 ? targets[0].id : undefined,
      createdAt: new Date().toISOString(),
      deleted: false,
    })
    await createFeedPost(post)
    setEncouragedIds(prev => {
      const next = new Set(prev)
      targets.forEach(u => next.add(u.id))
      return next
    })
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

        {/* ── Summary log card ── */}
        <DailyLogCard
          log={todayLog}
          target={target}
          onOpenLog={() => setLogModalOpen(true)}
        />

        {/* ── Quick-tap exercise cards ── */}
        {!isDayDone && <div className="space-y-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-1">
            Quick Tap
          </p>
          {target.exercises.map(({ exercise, reps }) => (
            <DailyExerciseCard
              key={exercise.id}
              exerciseId={exercise.id}
              name={exercise.name}
              targetReps={reps}
              fraction={quickFractions[exercise.id] ?? 0}
              onChange={handleQuickFraction}
              disabled={quickSaving}
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
              onSave={(date, fractions, notes, modNote, isMakeUp) =>
                saveLog(date, fractions, notes, modNote, isMakeUp)
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
                        <span className="flex-1 text-sm text-zinc-300 font-medium truncate">
                          {u.displayName}
                        </span>
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
      <LogDayModal
        open={logModalOpen}
        onClose={() => setLogModalOpen(false)}
        target={target}
        existingLog={todayLog}
        onSave={saveTodayLog}
        isMakeUp={false}
      />

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
