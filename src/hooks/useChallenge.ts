'use client'

import { useMemo } from 'react'
import { useRegion } from '@/contexts/RegionContext'
import { getCurrentChallenge, challengesForRegion, getTodayPT } from '@/lib/challenges'
import type { ChallengeTemplate } from '@/types'

/**
 * The current region's active challenge, or undefined if the region has no
 * challenge running today (a gap month — handle the empty state).
 *
 * Use this instead of calling getCurrentChallenge() directly in components:
 * two regions can run different challenges over the same dates, so a challenge
 * lookup is meaningless without a region.
 */
export function useCurrentChallenge(): ChallengeTemplate | undefined {
  const { regionId } = useRegion()
  return useMemo(() => getCurrentChallenge(regionId), [regionId])
}

/** Every challenge this region has run, oldest first. */
export function useRegionChallenges(): ChallengeTemplate[] {
  const { regionId } = useRegion()
  return useMemo(() => challengesForRegion(regionId), [regionId])
}

/**
 * This region's finished challenges, in definition order (oldest first).
 * Computed in the component so it re-evaluates if mounted across midnight.
 */
export function usePastChallenges(): ChallengeTemplate[] {
  const { regionId } = useRegion()
  return useMemo(() => {
    const today = getTodayPT()
    return challengesForRegion(regionId).filter(c => c.endDate < today)
  }, [regionId])
}
