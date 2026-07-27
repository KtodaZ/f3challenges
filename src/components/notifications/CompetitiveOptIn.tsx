'use client'

import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

/** Shared disclaimer used by the settings toggle, onboarding, and the
 *  leaderboard opt-in modal. Kept in one place so the message stays consistent. */
export const COMPETITIVE_DISCLAIMER =
  'Some PAX are fired up by competition, some aren’t — both are totally fine. ' +
  'This isn’t about beating anyone; it’s about all of us finishing together. ' +
  'But if a little friendly rivalry keeps you logging, flip it on — and turn it off any time.'

/** One-line example of what these notifications sound like. Mixes the weekly
 *  board (resets every Sunday) with the month-long standings. */
export const COMPETITIVE_EXAMPLE =
  '“Milkman is right on your heels in this week’s leaderboard — 40 reps back. Hold your spot.”'

interface CompetitiveOptInModalProps {
  open: boolean
  /** Called with the PAX’s choice. Either answer records that they’ve been
   *  asked, so the prompt never nags again. */
  onDecide: (optIn: boolean) => void
}

export function CompetitiveOptInModal({ open, onDecide }: CompetitiveOptInModalProps) {
  return (
    <Modal
      open={open}
      onClose={() => onDecide(false)}
      title="Want competitive nudges? 🏁"
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-zinc-800/60 border border-zinc-700 px-4 py-3">
          <p className="text-sm text-zinc-200 italic leading-relaxed">{COMPETITIVE_EXAMPLE}</p>
        </div>

        <p className="text-sm text-zinc-400 leading-relaxed">{COMPETITIVE_DISCLAIMER}</p>

        <div className="flex flex-col gap-2 pt-1">
          <Button variant="primary" size="lg" fullWidth onClick={() => onDecide(true)}>
            Turn on competitive nudges
          </Button>
          <Button variant="ghost" size="md" fullWidth onClick={() => onDecide(false)}>
            No thanks
          </Button>
        </div>
      </div>
    </Modal>
  )
}
