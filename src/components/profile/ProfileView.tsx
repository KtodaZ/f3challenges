'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { AdminBadge } from '@/components/ui/AdminBadge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Input } from '@/components/ui/Input'
import { TrophyCase } from '@/components/profile/TrophyCase'
import { TrophyTierSummary } from '@/components/profile/TrophyTierSummary'
import { TodaySummary } from '@/components/profile/TodaySummary'
import { HeatMap } from '@/components/profile/HeatMap'
import { CumulativeStats } from '@/components/profile/CumulativeStats'
import { RepBreakdown } from '@/components/profile/RepBreakdown'
import { OptOutModal } from '@/components/profile/OptOutModal'
import { ShoutoutModal } from '@/components/profile/ShoutoutModal'
import {
  getUserChallengeLogs,
  getParticipation,
  upsertParticipation,
  updateUser,
  participationId,
  getSocialStats,
  getUserBonusLogs,
  getChallengeLogs,
} from '@/lib/firestore'
import type { SocialStats } from '@/lib/firestore'
import { buildAchievementContext, evaluateAchievements } from '@/lib/achievements'
import type { BonusLog } from '@/types'
import {
  getCurrentChallenge,
  challengesForRegion,
  resolveRegion,
  getChallengeDates,
  getDailyTarget,
  getTodayPT,
  getWeekProgress,
} from '@/lib/challenges'
import { trophyAmount } from '@/lib/trophies'
import { useUser } from '@/contexts/UserContext'
import { useAdminRoles } from '@/hooks/useAdminRoles'
import type { User, DailyLog, ChallengeParticipation } from '@/types'

interface ProfileViewProps {
  profileUser: User
}

function statusBadge(status: ChallengeParticipation['status'], note?: string) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-900/40 border border-green-700/50 text-green-400 text-xs font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        Active
      </span>
    )
  }
  if (status === 'opted-out') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-900/40 border border-red-700/50 text-red-400 text-xs font-medium">
        🚫 Opted Out
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-900/40 border border-orange-700/50 text-orange-400 text-xs font-medium">
      ✏️ Modifying{note ? `: ${note}` : ''}
    </span>
  )
}

export function ProfileView({ profileUser: initialUser }: ProfileViewProps) {
  const { currentUser, refreshCurrentUser } = useUser()
  const adminRoles = useAdminRoles()
  const isOwnProfile = currentUser?.id === initialUser.id
  // The profile's own region, not the viewer's — a profile should read the
  // same whoever opens it, and it's what makes their badge history correct.
  const profileRegionId = resolveRegion(initialUser.regionId).id

  const [user, setUser] = useState<User>(initialUser)
  const [currentLogs, setCurrentLogs] = useState<DailyLog[]>([])
  const [allLogs, setAllLogs] = useState<DailyLog[]>([])
  const [participation, setParticipation] = useState<ChallengeParticipation | null>(null)
  const [loading, setLoading] = useState(true)

  // Extra context for achievement progress (social, bonus, group placements)
  const [socialStats, setSocialStats] = useState<SocialStats | null>(null)
  const [bonusLogs, setBonusLogs] = useState<BonusLog[] | null>(null)
  const [groupLogs, setGroupLogs] = useState<DailyLog[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const challenge = getCurrentChallenge(profileRegionId)
    Promise.all([
      getSocialStats(initialUser.id),
      getUserBonusLogs(initialUser.id),
      challenge ? getChallengeLogs(challenge.id) : Promise.resolve([]),
    ])
      .then(([s, b, g]) => {
        if (cancelled) return
        setSocialStats(s)
        setBonusLogs(b)
        setGroupLogs(g)
      })
      .catch(() => { /* progress just shows without social/bonus counts */ })
    return () => { cancelled = true }
  }, [initialUser.id, profileRegionId])

  const achievementEvaluations = useMemo(() => {
    const ctx = buildAchievementContext(user, allLogs, {
      givenShoutouts: socialStats?.givenShoutouts,
      shoutoutsReceived: socialStats?.shoutoutsReceived,
      commentsPosted: socialStats?.commentsPosted,
      photosUploaded: socialStats?.photosUploaded,
      videosUploaded: socialStats?.videosUploaded,
      bonusLogs: bonusLogs ?? undefined,
      groupLogs: groupLogs ?? undefined,
      currentChallengeId: getCurrentChallenge(profileRegionId)?.id,
    })
    return evaluateAchievements(ctx)
  }, [user, allLogs, socialStats, bonusLogs, groupLogs, profileRegionId])

  // Modal state
  const [editNameOpen, setEditNameOpen] = useState(false)
  const [editName, setEditName] = useState(user.displayName)
  const [editNameSaving, setEditNameSaving] = useState(false)
  const [optOutOpen, setOptOutOpen] = useState(false)
  const [shoutoutOpen, setShoutoutOpen] = useState(false)

  const currentChallenge = getCurrentChallenge(profileRegionId)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Load current challenge logs + participation
      const [currentLogsData, allLogsData, participationData] = await Promise.all([
        currentChallenge
          ? getUserChallengeLogs(user.id, currentChallenge.id)
          : Promise.resolve([]),
        // Load logs for all challenges
        Promise.all(challengesForRegion(profileRegionId).map(c => getUserChallengeLogs(user.id, c.id))).then(r => r.flat()),
        currentChallenge
          ? getParticipation(user.id, currentChallenge.id)
          : Promise.resolve(null),
      ])
      setCurrentLogs(currentLogsData)
      setAllLogs(allLogsData)
      setParticipation(participationData)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, currentChallenge?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Current month progress calculations
  const today = getTodayPT()
  const todayTarget = currentChallenge ? getDailyTarget(currentChallenge, today) : null
  const todayLog = currentLogs.find(l => l.date === today) ?? null
  const daysCompleted = currentLogs.filter(l => l.completionFraction >= 1).length
  // The trophy ladder isn't always scored in days — weekly-cumulative months
  // count reps. trophyAmount() is the one place that decides which.
  const trophyScore = currentChallenge ? trophyAmount(currentChallenge, currentLogs) : 0
  const weekProgress = currentChallenge
    ? getWeekProgress(currentChallenge, today, currentLogs, today)
    : null
  const totalDays = currentChallenge ? getChallengeDates(currentChallenge).filter(d => d <= today).length : 0
  const totalRepsLogged = currentLogs.reduce((sum, log) => {
    return sum + log.exerciseLogs.reduce((s, e) => s + e.completedReps, 0)
  }, 0)
  const progressPct = totalDays > 0 ? Math.round((daysCompleted / totalDays) * 100) : 0

  async function handleSaveName() {
    if (!editName.trim() || editName.trim() === user.displayName) {
      setEditNameOpen(false)
      return
    }
    setEditNameSaving(true)
    try {
      await updateUser(user.id, { displayName: editName.trim() })
      setUser(prev => ({ ...prev, displayName: editName.trim() }))
      refreshCurrentUser()
    } finally {
      setEditNameSaving(false)
      setEditNameOpen(false)
    }
  }

  async function handleRejoin() {
    if (!currentChallenge) return
    const now = new Date().toISOString()
    const updated: ChallengeParticipation = {
      id: participationId(user.id, currentChallenge.id),
      userId: user.id,
      challengeId: currentChallenge.id,
      status: 'active',
      joinedAt: participation?.joinedAt ?? now,
      updatedAt: now,
    }
    await upsertParticipation(updated)
    setParticipation(updated)
  }

  return (
    <div className="min-h-dvh bg-[#09090b] pb-nav">
      <div className="max-w-md mx-auto px-4 pt-6 pb-4 space-y-5">

        {/* ── Profile Header ─────────────────────────────────── */}
        <Card>
          <div className="flex items-start gap-4">
            <Avatar name={user.displayName} size="xl" />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-xl font-bold text-white leading-tight truncate">
                    {user.displayName}
                  </h1>
                  <AdminBadge role={adminRoles[user.id]} />
                </div>
                {isOwnProfile ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditName(user.displayName)
                      setEditNameOpen(true)
                    }}
                    className="shrink-0"
                  >
                    Edit
                  </Button>
                ) : (
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => setShoutoutOpen(true)}
                    className="shrink-0"
                  >
                    📣 Shout Out
                  </Button>
                )}
              </div>

              {/* Streak info */}
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-sm text-orange-400 font-medium">
                  🔥 {user.currentStreak} day streak
                </span>
                <span className="text-xs text-zinc-500">
                  Best: {user.longestStreak}d
                </span>
              </div>

              {/* No-notifications indicator */}
              {!user.fcmTokens?.length && (
                <div className="mt-1.5">
                  {isOwnProfile ? (
                    <Link
                      href="/settings/notifications"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-900/30 border border-amber-700/40 text-amber-400 text-xs"
                    >
                      🔕 Notifications off — set up
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-500 text-xs">
                      🔕 No push notifications
                    </span>
                  )}
                </div>
              )}

              {/* Participation status */}
              {participation && (
                <div className="mt-2">
                  {statusBadge(participation.status, participation.modificationNote)}
                </div>
              )}
            </div>
          </div>

          {/* Own profile: opt-out / rejoin actions */}
          {isOwnProfile && currentChallenge && (
            <div className="mt-4 pt-4 border-t border-zinc-800">
              {(!participation || participation.status === 'active' || participation.status === 'modifying') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOptOutOpen(true)}
                  className="text-zinc-500 hover:text-red-400"
                >
                  🚫 Opt out or modify challenge
                </Button>
              )}
              {participation?.status === 'opted-out' && (
                <div className="space-y-2">
                  {participation.optOutReason && (
                    <p className="text-xs text-zinc-500">
                      Reason: {participation.optOutReason}
                    </p>
                  )}
                  <Button
                    variant="success"
                    size="sm"
                    onClick={handleRejoin}
                  >
                    Rejoin Challenge
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ── Today: condensed done / to-do ──────────────────── */}
        {currentChallenge && todayTarget && (
          loading ? (
            <div className="h-24 bg-zinc-800 rounded-2xl animate-pulse" />
          ) : (
            <TodaySummary target={todayTarget} log={todayLog} week={weekProgress} />
          )
        )}

        {/* ── Current Month Progress ─────────────────────────── */}
        {currentChallenge && (
          <Card>
            <CardHeader>
              <CardTitle>{currentChallenge.name}</CardTitle>
              <span className="text-xs text-zinc-500 font-normal">
                {currentChallenge.hashtag}
              </span>
            </CardHeader>
            {loading ? (
              <div className="h-12 bg-zinc-800 rounded-xl animate-pulse" />
            ) : (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-white">
                    {daysCompleted}
                    <span className="text-base text-zinc-500 font-normal"> / {totalDays} days</span>
                  </span>
                  <span className="text-sm text-zinc-400">
                    {totalRepsLogged.toLocaleString()} reps
                  </span>
                </div>
                <ProgressBar
                  value={progressPct}
                  label="Days completed"
                  sublabel={`${progressPct}%`}
                  color={progressPct >= 100 ? 'green' : 'orange'}
                />
                <TrophyTierSummary challenge={currentChallenge} completed={trophyScore} />
              </div>
            )}
          </Card>
        )}

        {/* ── Rep breakdown: what the reps were made of ──────── */}
        {currentChallenge && (
          <Card id="breakdown">
            <CardHeader>
              <CardTitle>Breakdown</CardTitle>
              <span className="text-xs text-zinc-500 font-normal">{currentChallenge.name}</span>
            </CardHeader>
            {loading ? (
              <div className="h-32 bg-zinc-800 rounded-xl animate-pulse" />
            ) : (
              <RepBreakdown challenge={currentChallenge} logs={currentLogs} />
            )}
          </Card>
        )}

        {/* ── Activity Heat Map ──────────────────────────────── */}
        {currentChallenge && (
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            {loading ? (
              <div className="h-24 bg-zinc-800 rounded-xl animate-pulse" />
            ) : (
              <HeatMap challenge={currentChallenge} logs={currentLogs} />
            )}
          </Card>
        )}

        {/* ── Trophy Case: challenge badges + achievements ───── */}
        <Card>
          <CardHeader>
            <CardTitle>Trophy Case</CardTitle>
            <span className="text-xs text-zinc-500">
              {user.badges.length + (user.achievements?.length ?? 0)} earned
            </span>
          </CardHeader>
          <TrophyCase
            badges={user.badges}
            earned={user.achievements ?? []}
            evaluations={achievementEvaluations}
          />
        </Card>

        {/* ── Cumulative Stats ───────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>All-Time Stats</CardTitle>
          </CardHeader>
          {loading ? (
            <div className="h-32 bg-zinc-800 rounded-xl animate-pulse" />
          ) : (
            <CumulativeStats allLogs={allLogs} badges={user.badges} />
          )}
        </Card>
      </div>

      {/* ── Modals ─────────────────────────────────────────── */}
      <Modal open={editNameOpen} onClose={() => setEditNameOpen(false)} title="Edit F3 Name">
        <div className="space-y-4">
          <Input
            label="F3 Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Your F3 name"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName() }}
          />
          <div className="flex gap-2">
            <Button variant="ghost" fullWidth onClick={() => setEditNameOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              loading={editNameSaving}
              onClick={handleSaveName}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {currentChallenge && isOwnProfile && (
        <OptOutModal
          open={optOutOpen}
          onClose={() => setOptOutOpen(false)}
          userId={user.id}
          challengeId={currentChallenge.id}
          currentParticipation={participation}
          onSuccess={(updated) => setParticipation(updated)}
        />
      )}

      {!isOwnProfile && (
        <ShoutoutModal
          open={shoutoutOpen}
          onClose={() => setShoutoutOpen(false)}
          targetUser={user}
          challengeId={currentChallenge?.id}
        />
      )}
    </div>
  )
}
