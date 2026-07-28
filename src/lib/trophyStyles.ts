import type { TrophyTier } from '@/types'

/** Per-tier Tailwind classes — one place so the trophy reads the same
 *  everywhere it shows up (home nudge, profile, trophy case, celebration). */
export interface TrophyTierStyle {
  /** Small pill / chip. */
  chip: string
  /** Large square badge tile. */
  tile: string
  /** Text-only accent. */
  text: string
  /** Progress-bar fill. */
  bar: string
}

export const TROPHY_TIER_STYLES: Record<TrophyTier, TrophyTierStyle> = {
  participant: {
    chip: 'bg-zinc-800 border-zinc-700 text-zinc-300',
    tile: 'bg-zinc-800 border-zinc-700',
    text: 'text-zinc-300',
    bar: 'bg-zinc-500',
  },
  bronze: {
    chip: 'bg-orange-950/60 border-orange-800/70 text-orange-300',
    tile: 'bg-orange-950/60 border-orange-800/70',
    text: 'text-orange-300',
    bar: 'bg-gradient-to-r from-orange-700 to-orange-500',
  },
  silver: {
    chip: 'bg-slate-700/40 border-slate-500/50 text-slate-200',
    tile: 'bg-slate-700/40 border-slate-500/50',
    text: 'text-slate-200',
    bar: 'bg-gradient-to-r from-slate-500 to-slate-300',
  },
  gold: {
    chip: 'bg-amber-900/50 border-amber-600/60 text-amber-300',
    tile: 'bg-amber-900/50 border-amber-600/60',
    text: 'text-amber-300',
    bar: 'bg-gradient-to-r from-amber-500 to-yellow-400',
  },
}
