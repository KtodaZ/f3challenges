'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useUser } from '@/contexts/UserContext'
import { getShoutoutCounts, getUserBonusLogs } from '@/lib/firestore'
import {
  buildAchievementContext,
  evaluateAchievements,
  findNewlyEarned,
  getNextAchievements,
  awardAchievements,
} from '@/lib/achievements'
import type {
  AchievementDefinition,
  AchievementEvaluation,
  BonusLog,
  DailyLog,
  EarnedAchievement,
} from '@/types'

interface UseAchievementEngineOptions {
  /** All of the user's logs across challenges (current + past). */
  logs: DailyLog[]
  /** Challenge to attribute unlock feed posts to. */
  challengeId?: string
  /** Called once per batch of newly unlocked achievements. */
  onUnlocked?: (defs: AchievementDefinition[]) => void
}

/**
 * Evaluates the achievement catalog against the current user's data,
 * persists any newly earned achievements (with feed posts), and exposes
 * progress for the "next badge" near-miss card and the trophy case.
 *
 * Awards are idempotent: filtered against the persisted list, a session
 * ref, and deterministic feed-post IDs.
 */
export function useAchievementEngine({ logs, challengeId, onUnlocked }: UseAchievementEngineOptions) {
  const { currentUser, refreshCurrentUser } = useUser()

  const [social, setSocial] = useState<{ given: number; received: number } | null>(null)
  const [bonusLogs, setBonusLogs] = useState<BonusLog[] | null>(null)
  const sessionAwarded = useRef<EarnedAchievement[]>([])
  const awarding = useRef(false)

  const userId = currentUser?.id

  // Social + bonus context loads once per user
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    Promise.all([getShoutoutCounts(userId), getUserBonusLogs(userId)])
      .then(([s, b]) => {
        if (cancelled) return
        setSocial(s)
        setBonusLogs(b)
      })
      .catch(() => {
        if (cancelled) return
        setSocial({ given: 0, received: 0 })
        setBonusLogs([])
      })
    return () => { cancelled = true }
  }, [userId])

  const ctx = useMemo(() => {
    if (!currentUser) return null
    return buildAchievementContext(currentUser, logs, {
      shoutoutsGiven: social?.given,
      shoutoutsReceived: social?.received,
      bonusLogs: bonusLogs ?? undefined,
    })
  }, [currentUser, logs, social, bonusLogs])

  // Award anything newly earned
  useEffect(() => {
    if (!ctx || !currentUser || awarding.current) return
    const have = [...(currentUser.achievements ?? []), ...sessionAwarded.current]
    const fresh = findNewlyEarned(ctx, have)
    if (fresh.length === 0) return

    awarding.current = true
    awardAchievements({ ...currentUser, achievements: have }, fresh, challengeId)
      .then(earned => {
        sessionAwarded.current = [...sessionAwarded.current, ...earned]
        if (earned.length > 0) {
          onUnlocked?.(fresh.filter(d => earned.some(e => e.id === d.id)))
          refreshCurrentUser()
        }
      })
      .catch(() => { /* transient write failure — retried on next evaluation */ })
      .finally(() => { awarding.current = false })
  }, [ctx, currentUser, challengeId, onUnlocked, refreshCurrentUser])

  const evaluations: AchievementEvaluation[] = useMemo(
    () => (ctx ? evaluateAchievements(ctx) : []),
    [ctx]
  )

  const nextUp = useMemo(() => (ctx ? getNextAchievements(ctx, 2) : []), [ctx])

  return { evaluations, nextUp }
}
