'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { getTotalDays, getMonthlyTotal } from '@/lib/challenges'
import { usePastChallenges } from '@/hooks/useChallenge'
import type { AchievementBadge, ChallengeTemplate } from '@/types'

interface Props {
  onNext: (badges: AchievementBadge[]) => void
  existingBadges?: AchievementBadge[]
}

type Selection = 'completed' | 'participant' | 'skipped'

function initialSelections(
  historical: ChallengeTemplate[],
  existingBadges: AchievementBadge[] = [],
): Record<string, Selection> {
  const byId = Object.fromEntries(existingBadges.map(b => [b.challengeId, b.type as Selection]))
  return Object.fromEntries(historical.map(c => [c.id, byId[c.id] ?? 'skipped']))
}

export function PastChallengesStep({ onNext, existingBadges }: Props) {
  // Only this region's history — a brand-new region has none, and the step
  // should be skipped entirely rather than shown empty.
  const historical = usePastChallenges()
  const [selections, setSelections] = useState<Record<string, Selection>>(
    () => initialSelections(historical, existingBadges)
  )

  // Region resolves a tick after mount — re-seed so the selections match the
  // list actually being shown. See PastChallengesSettings for the same fix.
  const historicalKey = historical.map(c => c.id).join(',')
  useEffect(() => {
    setSelections(initialSelections(historical, existingBadges))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historicalKey])

  function select(challengeId: string, val: Selection) {
    setSelections(prev => ({ ...prev, [challengeId]: val }))
  }

  function handleContinue() {
    const badges: AchievementBadge[] = historical
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
        <h2 className="text-2xl font-bold text-white mb-2">Any previous W&apos;s?</h2>
        <p className="text-zinc-400 text-sm">Tell us about past challenges so we can add badges to your profile.</p>
      </div>

      <div className="space-y-4 flex-1">
        {historical.map(challenge => {
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
                    {opt === 'completed' ? '🥇 Completed'
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
