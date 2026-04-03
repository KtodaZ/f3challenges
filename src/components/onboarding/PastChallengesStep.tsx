'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { CHALLENGES, getTotalDays, getMonthlyTotal } from '@/lib/challenges'
import type { AchievementBadge } from '@/types'

interface Props {
  onNext: (badges: AchievementBadge[]) => void
  existingBadges?: AchievementBadge[]
}

type Selection = 'completed' | 'participant' | 'skipped'

const HISTORICAL = CHALLENGES.filter(c => c.id !== 'apr-2026')

function initialSelections(existingBadges: AchievementBadge[] = []): Record<string, Selection> {
  const byId = Object.fromEntries(existingBadges.map(b => [b.challengeId, b.type as Selection]))
  return Object.fromEntries(HISTORICAL.map(c => [c.id, byId[c.id] ?? 'skipped']))
}

export function PastChallengesStep({ onNext, existingBadges }: Props) {
  const [selections, setSelections] = useState<Record<string, Selection>>(
    () => initialSelections(existingBadges)
  )

  function select(challengeId: string, val: Selection) {
    setSelections(prev => ({ ...prev, [challengeId]: val }))
  }

  function handleContinue() {
    const badges: AchievementBadge[] = HISTORICAL
      .filter(c => selections[c.id] !== 'skipped')
      .map(c => ({
        challengeId: c.id,
        type: selections[c.id] as 'completed' | 'participant',
        awardedAt: new Date().toISOString(),
      }))
    onNext(badges)
  }

  return (
    <div className="flex flex-col min-h-full px-6 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Any previous W's?</h2>
        <p className="text-zinc-400 text-sm">Tell us about past challenges so we can add badges to your profile.</p>
      </div>

      <div className="space-y-4 flex-1">
        {HISTORICAL.map(challenge => {
          const days  = getTotalDays(challenge)
          const total = getMonthlyTotal(challenge)
          const sel   = selections[challenge.id]

          return (
            <div key={challenge.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <div className="mb-3">
                <p className="font-semibold text-white">{challenge.name}</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {new Date(challenge.startDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  {' · '}{days} days · {total.toLocaleString()} total reps
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  {challenge.exercises.map(e => e.name).join(', ')}
                </p>
              </div>

              <div className="flex gap-2">
                {(['completed', 'participant', 'skipped'] as Selection[]).map(opt => (
                  <button
                    key={opt}
                    onClick={() => select(challenge.id, opt)}
                    className={cn(
                      'flex-1 py-2 px-2 rounded-xl text-xs font-medium transition-colors border',
                      sel === opt
                        ? opt === 'completed'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                          : opt === 'participant'
                            ? 'bg-zinc-600/40 border-zinc-500 text-zinc-200'
                            : 'bg-zinc-800 border-zinc-600 text-zinc-400'
                        : 'bg-transparent border-zinc-800 text-zinc-500 hover:border-zinc-700'
                    )}
                  >
                    {opt === 'completed' ? '🏆 Completed'
                      : opt === 'participant' ? '🥈 Participated'
                      : 'Skipped'}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-8">
        <Button onClick={handleContinue} size="lg" fullWidth>
          Continue →
        </Button>
        <button
          onClick={() => onNext([])}
          className="w-full mt-3 text-sm text-zinc-500 hover:text-zinc-300 py-2 transition-colors"
        >
          Skip — no past challenges
        </button>
      </div>
    </div>
  )
}
