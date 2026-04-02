import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminMessaging } from '@/lib/firebase-admin'
import { generateNotificationMessage } from '@/lib/openai'
import { getCurrentChallenge, getDailyTarget, getTodayPT, getDayNumber, getTotalDays } from '@/lib/challenges'
import type { User, DailyLog, ChallengeParticipation } from '@/types'

// Vercel Cron hits this every hour. We check which users have a notification due.
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const challenge = getCurrentChallenge()
  if (!challenge) return NextResponse.json({ skipped: 'no active challenge' })

  const today    = getTodayPT()
  const nowPT    = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
  const nowDate  = new Date(nowPT)
  const nowHour  = nowDate.getHours()
  const nowMin   = nowDate.getMinutes()
  const isWeeklyRecapTime = nowDate.getDay() === 0 // Sunday

  // Get all users
  const usersSnap = await adminDb.collection('users').get()
  const users     = usersSnap.docs.map(d => d.data() as User)

  // Get today's group completion stats
  const logsSnap = await adminDb.collection('dailyLogs')
    .where('challengeId', '==', challenge.id)
    .where('date', '==', today)
    .get()
  const todayLogs = logsSnap.docs.map(d => d.data() as DailyLog)
  const groupCompleted = todayLogs.filter(l => l.completionFraction >= 1).length

  const dayNumber  = getDayNumber(challenge, today) ?? 1
  const totalDays  = getTotalDays(challenge)
  const target     = getDailyTarget(challenge, today)
  const todayReps  = target?.totalReps ?? 0

  const results: string[] = []

  for (const user of users) {
    if (!user.fcmToken) continue
    const prefs = user.notificationPreferences
    if (!prefs) continue

    // Determine which notification type applies now
    type NotifType = 'morning' | 'afternoon' | 'evening' | 'weekly_recap'
    const windows: Array<{ type: NotifType; pref: { enabled: boolean; time: string } }> = [
      { type: 'morning',      pref: prefs.morning },
      { type: 'afternoon',    pref: prefs.afternoon },
      { type: 'evening',      pref: prefs.evening },
      ...(isWeeklyRecapTime ? [{ type: 'weekly_recap' as NotifType, pref: prefs.weeklyRecap }] : []),
    ]

    for (const { type, pref } of windows) {
      if (!pref.enabled) continue

      const [prefHour, prefMin] = pref.time.split(':').map(Number)
      const diffMins = Math.abs((nowHour * 60 + nowMin) - (prefHour * 60 + prefMin))
      if (diffMins > 5) continue // only fire within 5-min window

      // Check if already sent this notification today
      const logKey = `${user.id}_${today}_${type}`
      const sentDoc = await adminDb.collection('notificationLog').doc(logKey).get()
      if (sentDoc.exists) continue

      // Get user's today log + participation
      const userLogSnap = await adminDb.collection('dailyLogs').doc(`${user.id}_${today}`).get()
      const userLog     = userLogSnap.exists ? (userLogSnap.data() as DailyLog) : null

      const partSnap = await adminDb.collection('participation').doc(`${user.id}_${challenge.id}`).get()
      const part     = partSnap.exists ? (partSnap.data() as ChallengeParticipation) : null

      let statusStr: string = part?.status ?? 'active'
      if (statusStr === 'modifying' && part?.modificationNote) {
        statusStr = `modifying: ${part.modificationNote}`
      }

      // Calculate this week's stats for weekly recap
      let weeklyCompletedDays: number | undefined
      let weeklyTotalDays: number | undefined
      if (type === 'weekly_recap') {
        const weekAgo = new Date(nowDate)
        weekAgo.setDate(weekAgo.getDate() - 7)
        const weekAgoStr = weekAgo.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
        const weekLogsSnap = await adminDb.collection('dailyLogs')
          .where('userId', '==', user.id)
          .where('challengeId', '==', challenge.id)
          .where('date', '>=', weekAgoStr)
          .where('date', '<=', today)
          .get()
        const weekLogs = weekLogsSnap.docs.map(d => d.data() as DailyLog)
        weeklyCompletedDays = weekLogs.filter(l => l.completionFraction >= 1).length
        weeklyTotalDays = 7
      }

      try {
        const { title, body } = await generateNotificationMessage({
          userName:            user.displayName,
          challengeName:       challenge.name,
          dayNumber,
          totalDays,
          todayTarget:         todayReps,
          userCompleted:       (userLog?.completionFraction ?? 0) >= 1,
          completionFraction:  userLog?.completionFraction ?? 0,
          groupCompletedCount: groupCompleted,
          groupTotalCount:     users.length,
          userStreak:          user.currentStreak ?? 0,
          participationStatus: statusStr,
          notificationType:    type,
          weeklyCompletedDays,
          weeklyTotalDays,
        })

        await adminMessaging.send({
          token: user.fcmToken,
          notification: { title, body },
          webpush: {
            notification: {
              icon: '/icons/icon-192.png',
              badge: '/icons/icon-192.png',
              vibrate: [200, 100, 200],
            },
            fcmOptions: { link: '/' },
          },
        })

        // Mark as sent
        await adminDb.collection('notificationLog').doc(logKey).set({ sentAt: new Date().toISOString() })
        results.push(`sent ${type} to ${user.displayName}`)
      } catch (err) {
        console.error(`[notify] failed for ${user.displayName}:`, err)
        results.push(`failed ${type} for ${user.displayName}`)
      }
    }
  }

  return NextResponse.json({ sent: results.length, results })
}
