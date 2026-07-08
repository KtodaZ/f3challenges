/**
 * Builders for full-screen celebration moments (CelebrationOverlay content).
 * Kept out of page components so the copy lives in one place.
 */

import type { CelebrationContent } from '@/components/ui/CelebrationOverlay'
import type { AchievementDefinition } from '@/types'

export type MilestoneKind = 'quarter' | 'half' | 'threeQuarter'

export function buildMilestoneCelebration(
  kind: MilestoneKind,
  stats: { repsBanked: number; daysLeft: number; challengeName: string },
): CelebrationContent {
  const reps = stats.repsBanked.toLocaleString()
  const copy: Record<MilestoneKind, CelebrationContent> = {
    quarter: {
      theme: 'fireworks',
      emoji: '🎉',
      kicker: `${stats.challengeName} · 25%`,
      title: 'QUARTER\nCONQUERED',
      subtitle: `A quarter of the challenge is behind you — ${reps} reps banked.`,
      detail: { emoji: '⛰️', title: '25% Complete', caption: `${stats.daysLeft} days to go — keep climbing` },
      buttonLabel: 'KEEP CLIMBING 💪',
    },
    half: {
      theme: 'fireworks',
      emoji: '🏔️',
      kicker: `${stats.challengeName} · 50%`,
      title: 'HALFWAY\nTHERE',
      subtitle: `${reps} reps down. The summit is in sight.`,
      detail: { emoji: '🔥', title: '50% Complete', caption: `${stats.daysLeft} days left — the second half is where it gets real` },
      buttonLabel: 'BRING ON THE HALF 🔥',
    },
    threeQuarter: {
      theme: 'fireworks',
      emoji: '🚀',
      kicker: `${stats.challengeName} · 75%`,
      title: 'HOME\nSTRETCH',
      subtitle: `Three quarters done — ${reps} reps banked. Don't fold now.`,
      detail: { emoji: '🏁', title: '75% Complete', caption: `Only ${stats.daysLeft} days between you and the finish line` },
      buttonLabel: 'FINISH THE FIGHT 🏁',
    },
  }
  return copy[kind]
}

export function buildRedemptionCelebration(
  dayNumber: number,
  remainingMissed: number,
): CelebrationContent {
  return {
    theme: 'embers',
    emoji: '⚡',
    kicker: 'Catch Up',
    title: `DAY ${dayNumber}:\nREDEEMED`,
    subtitle: 'That day was gone — and you took it back.',
    detail: remainingMissed > 0
      ? {
          emoji: '⏳',
          title: `${remainingMissed} missed ${remainingMissed === 1 ? 'day' : 'days'} left`,
          caption: 'Clear them all for a clean slate',
        }
      : undefined,
    buttonLabel: remainingMissed > 0 ? 'KEEP DIGGING OUT ⛏️' : "LET'S GO! 💪",
  }
}

export function buildDebtFreeCelebration(): CelebrationContent {
  return {
    theme: 'embers',
    emoji: '🧹',
    kicker: 'Catch Up',
    title: 'ALL\nCAUGHT UP',
    subtitle: 'Every missed day cleared. Nothing left behind.',
    detail: { emoji: '✨', title: 'Clean Slate', caption: 'You fell behind and fought all the way back' },
    buttonLabel: 'DEBT FREE 💪',
  }
}

export function buildUnlockCelebration(def: AchievementDefinition): CelebrationContent {
  return {
    theme: def.theme,
    emoji: def.emoji,
    kicker: 'Achievement Unlocked',
    title: def.name.toUpperCase(),
    subtitle: def.description,
    detail: { emoji: '🏅', title: `${def.name} added to your trophy case` },
    buttonLabel: 'CLAIM IT 🏅',
  }
}

/** Retroactive floods (first run for existing users) collapse into one modal. */
export function buildMultiUnlockCelebration(defs: AchievementDefinition[]): CelebrationContent {
  return {
    theme: 'gold',
    emoji: defs.map(d => d.emoji).slice(0, 3).join(''),
    kicker: 'Achievements Unlocked',
    title: `${defs.length} NEW\nBADGES`,
    subtitle: defs.map(d => `${d.emoji} ${d.name}`).join(' · '),
    detail: { emoji: '🏅', title: 'Trophy case updated', caption: 'Check your profile to see them all' },
    buttonLabel: 'CLAIM THEM 🏅',
  }
}
