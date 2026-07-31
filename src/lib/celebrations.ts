/**
 * Builders for full-screen celebration moments (CelebrationOverlay content).
 * Kept out of page components so the copy lives in one place.
 */

import type { CelebrationContent } from '@/components/ui/CelebrationOverlay'
import { getTrophyProgress, getTrophyTier } from '@/lib/challenges'
import type { AchievementDefinition, ChallengeTemplate, TrophyTier, WeekProgress } from '@/types'

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

/**
 * Claiming a 🥉 Bronze or 🥈 Silver trophy. Gold gets the bigger
 * CelebrationModal instead, and 🎖️ Participant is awarded quietly.
 *
 * `ended` flips the copy for a challenge that's already over — that trophy was
 * climbed with makeup days, which deserves its own nod.
 */
export function buildTrophyCelebration(
  tier: TrophyTier,
  challenge: ChallengeTemplate,
  completedDays: number,
  ended = false,
): CelebrationContent {
  const def = getTrophyTier(tier, challenge)
  const progress = getTrophyProgress(challenge, completedDays)
  const next = progress.next
  return {
    theme: tier === 'silver' ? 'gold' : 'embers',
    emoji: def.emoji,
    kicker: ended ? `${challenge.name} · Catch Up` : challenge.name,
    title: `${def.label.toUpperCase()}\nTROPHY`,
    subtitle: ended
      ? `${completedDays.toLocaleString()} of ${progress.required.toLocaleString()} ${progress.unit.many} — and you went back for them.`
      : def.blurb,
    detail: next
      ? {
          emoji: next.emoji,
          title: `${next.label} at ${progress.nextTierAmount.toLocaleString()} ${progress.unit.many}`,
          caption: `${progress.toNext.toLocaleString()} more ${progress.toNext === 1 ? progress.unit.one : progress.unit.many} to upgrade`,
        }
      : undefined,
    buttonLabel: next ? `GOING FOR ${next.label.toUpperCase()} ${next.emoji}` : 'CLAIM IT 🏅',
  }
}

/**
 * Crossing a week's rep target on a weekly-cumulative challenge — the moment
 * that replaces "day complete" on these challenges. Finishing with days still
 * on the clock gets its own line; that's the flex worth calling out.
 */
export function buildWeekCelebration(
  week: WeekProgress,
  challengeName: string,
  isMakeUp = false,
): CelebrationContent {
  const target = week.target.toLocaleString()
  return {
    theme: isMakeUp ? 'embers' : 'confetti',
    emoji: isMakeUp ? '✅' : '💪',
    kicker: isMakeUp ? `${challengeName} · Catch Up` : challengeName,
    title: `WEEK ${week.week.index}\nCOMPLETE`,
    subtitle: isMakeUp
      ? `You went back and finished it — all ${target}. No week left behind.`
      : `${target} in the bank. That's the week.`,
    detail: !isMakeUp && week.daysLeft >= 2
      ? {
          emoji: '⏱️',
          title: `${week.daysLeft} days to spare`,
          caption: 'Everything from here is interest',
        }
      : undefined,
    buttonLabel: 'BANKED 💪',
  }
}

export function buildUnlockCelebration(def: AchievementDefinition, featured = false): CelebrationContent {
  return {
    theme: featured ? 'fireworks' : def.theme,
    emoji: def.emoji,
    kicker: featured ? '🎪 Badge of the Month Unlocked' : 'Achievement Unlocked',
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
