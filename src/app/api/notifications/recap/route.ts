import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { generateWeeklyRecap } from '@/lib/openai'
import {
  getCurrentChallenge,
  resolveRegion,
  getTodayPT,
  getDayNumber,
  getTotalDays,
  getChallengeDates,
  isRestDay,
  conditionalRestApplies,
  getAchievementById,
  getNextAchievements,
  nearMissLabel,
  getWeekProgress,
} from '@/lib/challenges'
import type {
  AchievementContext,
  AchievementLogInput,
  ChallengeParticipation,
  DailyLog,
  User,
} from '@/types'

// AI weekly recap generator. Called by the scheduled Cloud Function
// (sendScheduledNotifications) when a user's weekly-recap window hits;
// the function sends the push and falls back to a template if this fails.
//
// POST { userId } → { title, body }
// Auth: Authorization: Bearer <CRON_SECRET>

function toAchievementLog(log: DailyLog): AchievementLogInput {
  return {
    date: log.date,
    challengeId: log.challengeId,
    completionFraction: log.completionFraction,
    isMakeUp: log.isMakeUp ?? false,
    loggedAt: log.completedAt ?? log.updatedAt ?? log.loggedAt,
    completedReps: log.exerciseLogs?.reduce((s, e) => s + e.completedReps, 0) ?? 0,
    targetReps: log.exerciseLogs?.reduce((s, e) => s + e.targetReps, 0) ?? 0,
  }
}

function daysAgoPT(days: number): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  now.setDate(now.getDate() - days)
  return now.toLocaleDateString('en-CA')
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
  }

  const { userId } = await req.json().catch(() => ({}))
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  // The user has to be resolved first: which challenge is "current" depends on
  // their region, since regions run different challenges over the same dates.
  const userSnap = await adminDb.collection('users').doc(userId).get()
  if (!userSnap.exists) {
    return NextResponse.json({ error: 'user not found' }, { status: 404 })
  }
  const user = userSnap.data() as User

  const challenge = getCurrentChallenge(resolveRegion(user.regionId).id)
  if (!challenge) {
    return NextResponse.json({ error: 'no active challenge' }, { status: 404 })
  }

  const today = getTodayPT()
  const weekStart = daysAgoPT(6) // last 7 calendar days, inclusive of today

  const [userLogsSnap, groupWeekSnap, partSnap] = await Promise.all([
    adminDb.collection('dailyLogs').where('userId', '==', userId).get(),
    adminDb.collection('dailyLogs')
      .where('challengeId', '==', challenge.id)
      .where('date', '>=', weekStart)
      .get(),
    adminDb.collection('participation').doc(`${userId}_${challenge.id}`).get(),
  ])

  const allLogs = userLogsSnap.docs.map(d => d.data() as DailyLog)
  const currentLogs = allLogs.filter(l => l.challengeId === challenge.id)

  // ── This week, for this user ──
  const weekLogs = currentLogs.filter(l => l.date >= weekStart && l.date <= today)
  const weeklyCompletedDays = weekLogs.filter(l => l.completionFraction >= 1).length
  const weeklyReps = weekLogs.reduce(
    (s, l) => s + (l.exerciseLogs?.reduce((a, e) => a + e.completedReps, 0) ?? 0), 0)

  const weekStartIso = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const madeUpDaysThisWeek = allLogs.filter(l =>
    l.isMakeUp && l.completionFraction >= 1 && (l.updatedAt ?? l.loggedAt) >= weekStartIso
  ).length

  const challengeDates = getChallengeDates(challenge)
  const daysPossibleThisWeek = challengeDates.filter(d =>
    d >= weekStart && d <= today && !isRestDay(challenge, d)
  ).length

  // ── Badges earned this week + nearest near-miss ──
  const badgesEarnedThisWeek = (user.achievements ?? [])
    .filter(a => a.awardedAt >= weekStartIso)
    .map(a => getAchievementById(a.id))
    .filter((d): d is NonNullable<typeof d> => !!d)
    .map(d => `${d.emoji} ${d.name}`)

  const achievementCtx: AchievementContext = {
    logs: allLogs.map(toAchievementLog),
    regionId: resolveRegion(user.regionId).id,
    longestStreak: Math.max(user.longestStreak ?? 0, user.currentStreak ?? 0),
  }
  const next = getNextAchievements(achievementCtx, 1)[0]
  const nextBadge = next
    ? { name: next.def.name, emoji: next.def.emoji, remaining: nearMissLabel(next) }
    : undefined

  // ── Missed days still open to make up ──
  const completedDates = currentLogs.filter(l => l.completionFraction >= 1).map(l => l.date)
  const completedSet = new Set(completedDates)
  const missedDaysOutstanding = challengeDates.filter(d => {
    if (d >= today) return false
    if (isRestDay(challenge, d)) return false
    if (conditionalRestApplies(challenge, d, completedDates)) return false
    return !completedSet.has(d)
  }).length

  // ── Group standing this week (by reps logged) ──
  const repsByUser = new Map<string, number>()
  for (const doc of groupWeekSnap.docs) {
    const log = doc.data() as DailyLog
    const reps = log.exerciseLogs?.reduce((a, e) => a + e.completedReps, 0) ?? 0
    repsByUser.set(log.userId, (repsByUser.get(log.userId) ?? 0) + reps)
  }
  const ranking = [...repsByUser.entries()].sort((a, b) => b[1] - a[1])
  const rankIndex = ranking.findIndex(([id]) => id === userId)
  const groupWeeklyRank = rankIndex >= 0 ? rankIndex + 1 : undefined
  const groupSize = ranking.length || undefined

  // ── Participation ──
  const part = partSnap.exists ? (partSnap.data() as ChallengeParticipation) : null
  let participationStatus: string = part?.status ?? 'active'
  if (participationStatus === 'opted-out') {
    return NextResponse.json({ error: 'user opted out' }, { status: 409 })
  }
  if (participationStatus === 'modifying' && part?.modificationNote) {
    participationStatus = `modifying: ${part.modificationNote}`
  }

  const { title, body } = await generateWeeklyRecap({
    userName: user.displayName,
    challengeName: challenge.name,
    hashtag: challenge.hashtag,
    dayNumber: getDayNumber(challenge, today) ?? 1,
    totalDays: getTotalDays(challenge),
    weeklyCompletedDays,
    daysPossibleThisWeek,
    weeklyReps,
    madeUpDaysThisWeek,
    currentStreak: user.currentStreak ?? 0,
    // Weekly-cumulative challenges are scored on the week's rep total, not on
    // days finished — hand the recap that number so it talks about the right thing.
    weeklyTarget: getWeekProgress(challenge, today, currentLogs)?.target,
    badgesEarnedThisWeek,
    nextBadge,
    missedDaysOutstanding,
    groupWeeklyRank,
    groupSize,
    participationStatus,
    regionName: resolveRegion(user.regionId).name,
  })

  return NextResponse.json({ title, body })
}
