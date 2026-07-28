import { describe, it, expect } from 'vitest'
import {
  TROPHY_TIERS,
  getTrophyProgress,
  getTrophyTier,
  legacyBadgeType,
  nextTrophyTier,
  resolveBadgeTier,
  tierDaysRequired,
  tierForCompletedDays,
  trophyFeedPost,
  trophyNotification,
  trophyNudge,
  trophyTierRank,
  trophyUpgrade,
} from './trophies'
import { getChallengeById, getRequiredDays } from './challenges'
import type { ChallengeTemplate } from './types'

// feb-2026: 28 days, no rest days → 28 required days.
const feb = getChallengeById('feb-2026') as ChallengeTemplate
// may-2026: 31 days with one rest day → 30 required days.
const may = getChallengeById('may-2026') as ChallengeTemplate

function nudge(completedDays: number, opts: { elapsed?: number; missed?: number } = {}) {
  return trophyNudge({
    challenge: feb,
    progress: getTrophyProgress(feb, completedDays),
    elapsedRequiredDays: opts.elapsed ?? completedDays,
    missedDays: opts.missed ?? 0,
  })
}

describe('tier thresholds', () => {
  it('places the rungs at 50% / 80% / 100% of required days', () => {
    expect(getRequiredDays(feb)).toBe(28)
    expect(tierDaysRequired(feb, 'bronze')).toBe(14)
    expect(tierDaysRequired(feb, 'silver')).toBe(23) // ceil(28 * 0.8) = 23
    expect(tierDaysRequired(feb, 'gold')).toBe(28)
  })

  it('measures against required days, not calendar days', () => {
    expect(getRequiredDays(may)).toBe(30) // 31 days minus one rest day
    expect(tierDaysRequired(may, 'bronze')).toBe(15)
    expect(tierDaysRequired(may, 'silver')).toBe(24)
    expect(tierDaysRequired(may, 'gold')).toBe(30)
  })

  it('never asks for zero days', () => {
    const tiny = { ...feb, startDate: '2026-02-01', endDate: '2026-02-01' } as ChallengeTemplate
    expect(tierDaysRequired(tiny, 'bronze')).toBe(1)
  })
})

describe('tierForCompletedDays', () => {
  it('awards nothing with no completed days', () => {
    expect(tierForCompletedDays(feb, 0)).toBeNull()
  })

  it('climbs participant → bronze → silver → gold', () => {
    expect(tierForCompletedDays(feb, 1)).toBe('participant')
    expect(tierForCompletedDays(feb, 13)).toBe('participant')
    expect(tierForCompletedDays(feb, 14)).toBe('bronze')
    expect(tierForCompletedDays(feb, 22)).toBe('bronze')
    expect(tierForCompletedDays(feb, 23)).toBe('silver')
    expect(tierForCompletedDays(feb, 27)).toBe('silver')
    expect(tierForCompletedDays(feb, 28)).toBe('gold')
  })

  it('caps at gold when extra days are logged', () => {
    expect(tierForCompletedDays(feb, 40)).toBe('gold')
  })
})

describe('progress', () => {
  it('points at the next rung and the days it costs', () => {
    const p = getTrophyProgress(feb, 10)
    expect(p.earned?.tier).toBe('participant')
    expect(p.next?.tier).toBe('bronze')
    expect(p.daysToNext).toBe(4)
  })

  it('chases bronze before any day is logged', () => {
    const p = getTrophyProgress(feb, 0)
    expect(p.earned).toBeNull()
    expect(p.next?.tier).toBe('bronze')
    expect(p.daysToNext).toBe(14)
  })

  it('has nothing left to chase at gold', () => {
    const p = getTrophyProgress(feb, 28)
    expect(p.earned?.tier).toBe('gold')
    expect(p.next).toBeNull()
    expect(p.daysToNext).toBe(0)
    expect(p.fraction).toBe(1)
  })
})

describe('legacy badges', () => {
  it('reads the old completion badge as gold', () => {
    expect(resolveBadgeTier({ type: 'completed' })).toBe('gold')
  })

  it('reads every old participant badge as silver — past trophies never shrink', () => {
    expect(resolveBadgeTier({ type: 'participant' })).toBe('silver')
    expect(resolveBadgeTier({})).toBe('silver')
  })

  it('prefers an explicit tier over the legacy type', () => {
    expect(resolveBadgeTier({ type: 'participant', tier: 'bronze' })).toBe('bronze')
  })

  it('writes a legacy type alongside every tier', () => {
    expect(legacyBadgeType('gold')).toBe('completed')
    expect(legacyBadgeType('silver')).toBe('participant')
    expect(legacyBadgeType('participant')).toBe('participant')
  })
})

describe('trophyUpgrade', () => {
  it('awards a first trophy', () => {
    expect(trophyUpgrade(undefined, 'bronze')).toBe('bronze')
  })

  it('upgrades when the new tier is higher', () => {
    expect(trophyUpgrade({ tier: 'bronze' }, 'silver')).toBe('silver')
    expect(trophyUpgrade({ tier: 'participant' }, 'gold')).toBe('gold')
  })

  it('stays put when the tier has not moved', () => {
    expect(trophyUpgrade({ tier: 'silver' }, 'silver')).toBeNull()
  })

  it('never downgrades — including a legacy participant badge sitting at silver', () => {
    expect(trophyUpgrade({ tier: 'gold' }, 'bronze')).toBeNull()
    expect(trophyUpgrade({ type: 'participant' }, 'bronze')).toBeNull()
    expect(trophyUpgrade({ type: 'completed' }, 'silver')).toBeNull()
  })

  it('still lets a legacy participant badge reach gold', () => {
    expect(trophyUpgrade({ type: 'participant' }, 'gold')).toBe('gold')
  })

  it('does nothing when no tier is earned at all', () => {
    expect(trophyUpgrade(undefined, null)).toBeNull()
  })
})

describe('tier ordering', () => {
  it('ranks ascending, gold on top', () => {
    const ranks = TROPHY_TIERS.map(t => trophyTierRank(t.tier))
    expect(ranks).toEqual([0, 1, 2, 3])
    expect(getTrophyTier('gold').emoji).toBe('🥇')
  })

  it('walks up the ladder and stops at gold', () => {
    expect(nextTrophyTier(null)?.tier).toBe('bronze')
    expect(nextTrophyTier('participant')?.tier).toBe('bronze')
    expect(nextTrophyTier('bronze')?.tier).toBe('silver')
    expect(nextTrophyTier('silver')?.tier).toBe('gold')
    expect(nextTrophyTier('gold')).toBeNull()
  })
})

describe('nudge copy', () => {
  it('always names the next tier and the days it costs', () => {
    const n = nudge(10)
    expect(n.headline).toContain('Bronze')
    expect(n.body).toContain('4 more days')
  })

  it('singularises the last day', () => {
    const n = nudge(13)
    expect(n.headline).toContain('one day away')
  })

  it('opens with bronze when nothing is logged', () => {
    const n = nudge(0)
    expect(n.headline).toContain('Bronze')
    expect(n.body).toContain('14 days')
  })

  it('stops asking once gold is in hand', () => {
    const n = nudge(28)
    expect(n.headline).toContain('Gold')
    expect(n.body).not.toContain('more days')
  })

  it('points at Catch Up when days are owed', () => {
    const n = nudge(10, { elapsed: 15, missed: 5 })
    expect(n.body).toContain('Catch Up')
  })

  it('says gold is still live when the user is on pace', () => {
    const n = nudge(20, { elapsed: 20 })
    expect(n.body).toContain('Gold')
  })

  it('drops the pace claim when the user is behind', () => {
    const n = nudge(15, { elapsed: 25, missed: 10 })
    expect(n.body).toContain('Silver')
  })
})

describe('announcement copy', () => {
  it('announces each tier by name', () => {
    const post = (tier: 'bronze' | 'silver' | 'gold') =>
      trophyFeedPost({ userName: 'Milkman', challenge: feb, tier, completedDays: 14 })
    expect(post('bronze')).toContain('🥉')
    expect(post('silver')).toContain('🥈')
    expect(post('gold')).toContain('every single day')
    expect(post('bronze')).toContain('@Milkman')
  })

  it('pushes the next rung in the notification', () => {
    const n = trophyNotification({ challenge: feb, tier: 'bronze', completedDays: 14 })
    expect(n.title).toContain('Bronze')
    expect(n.body).toContain('Silver')
    expect(n.body).toContain('9 more days')
  })

  it('has no next rung to push at gold', () => {
    const n = trophyNotification({ challenge: feb, tier: 'gold', completedDays: 28 })
    expect(n.body).not.toContain('more days')
  })
})
