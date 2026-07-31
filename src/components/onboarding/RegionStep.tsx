'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useRegion } from '@/contexts/RegionContext'
import { REGIONS, getCurrentChallenge } from '@/lib/challenges'
import { cn } from '@/lib/utils'

interface RegionStepProps {
  onNext: () => void
}

/**
 * Which F3 region this PAX posts with. Skipped entirely when an invite link
 * (`?region=…`) already answered it — see the onboarding page's step list.
 *
 * The region decides which roster, feed, leaderboard, and challenge they see,
 * so it's asked before the profile step: the name picker has to know which
 * crew to list.
 */
export function RegionStep({ onNext }: RegionStepProps) {
  const { regionId, setRegion } = useRegion()
  const [selected, setSelected] = useState<string>(regionId)

  function handleContinue() {
    setRegion(selected)
    onNext()
  }

  return (
    <div className="flex-1 flex flex-col px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white mb-2">Where do you post?</h1>
        <p className="text-zinc-400 text-sm">
          Pick your region. You&apos;ll see your own crew&apos;s challenge, leaderboard, and feed.
        </p>
      </div>

      <div className="flex-1 space-y-3">
        {REGIONS.map(region => {
          const challenge = getCurrentChallenge(region.id)
          const isSelected = selected === region.id
          return (
            <button
              key={region.id}
              onClick={() => setSelected(region.id)}
              className={cn(
                'w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all',
                isSelected
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700 active:border-zinc-600'
              )}
            >
              <div
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center shrink-0 border-2 font-black text-sm',
                  isSelected
                    ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-400'
                )}
              >
                F3
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('font-semibold leading-tight', isSelected ? 'text-orange-400' : 'text-white')}>
                  {region.shortName}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5 truncate">
                  {challenge ? `This month: ${challenge.name}` : 'No challenge running right now'}
                </p>
              </div>
              {isSelected && (
                <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 8 7" fill="none" className="w-3 h-3">
                    <path d="M1 3.5L3 5.5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className="pt-6">
        <Button variant="primary" size="lg" fullWidth onClick={handleContinue}>
          Continue →
        </Button>
        <p className="text-center text-xs text-zinc-600 mt-3">
          Posting somewhere else? Ask your Q for an invite link.
        </p>
      </div>
    </div>
  )
}
