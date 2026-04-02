'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

interface DisclaimerStepProps {
  onNext: () => void
}

export function DisclaimerStep({ onNext }: DisclaimerStepProps) {
  const [checked, setChecked] = useState(false)

  return (
    <div className="flex-1 flex flex-col px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white mb-2">Safety First, PAX</h1>
        <p className="text-zinc-400 text-sm">Before we get after it — a few important notes.</p>
      </div>

      {/* Quote card */}
      <Card className="mb-6 border-orange-500/30 bg-orange-500/5">
        <div className="flex gap-3">
          <div className="w-1 rounded-full bg-orange-500 shrink-0" />
          <p className="text-orange-400 font-bold text-base italic leading-snug">
            &quot;Modify to prevent injury, but not to prevent growth.&quot;
          </p>
        </div>
      </Card>

      {/* Body content */}
      <div className="space-y-4 mb-8 flex-1">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-sm">🛡️</span>
          </div>
          <div>
            <p className="text-white font-semibold text-sm mb-1">Modify when needed</p>
            <p className="text-zinc-400 text-sm leading-relaxed">
              If you&apos;re dealing with an injury or physical limitation, always modify the exercise to keep yourself safe. Your long-term health comes first.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-sm">📊</span>
          </div>
          <div>
            <p className="text-white font-semibold text-sm mb-1">Log partial completions</p>
            <p className="text-zinc-400 text-sm leading-relaxed">
              You can always log 25%, 50%, or 75% completion — something is always better than nothing. The crew sees your effort, not just the finish line.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-sm">🤙</span>
          </div>
          <div>
            <p className="text-white font-semibold text-sm mb-1">Opt out with grace</p>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Life happens. You can opt out of a day or the entire challenge with a reason — no judgment from the PAX. We&apos;re here to support, not shame.
            </p>
          </div>
        </div>
      </div>

      {/* Checkbox */}
      <div className="mb-6">
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative mt-0.5 shrink-0">
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              className="sr-only"
            />
            <div className={cn(
              'w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all',
              checked
                ? 'bg-orange-500 border-orange-500'
                : 'border-zinc-600 bg-zinc-800 group-hover:border-zinc-500'
            )}>
              {checked && (
                <svg viewBox="0 0 12 10" fill="none" className="w-3 h-3">
                  <path d="M1 5L4.5 8.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>
          <span className="text-sm text-zinc-300 leading-relaxed">
            I understand — let&apos;s get after it
          </span>
        </label>
      </div>

      {/* CTA */}
      <Button
        variant="primary"
        size="lg"
        fullWidth
        disabled={!checked}
        onClick={onNext}
      >
        Continue
      </Button>
    </div>
  )
}
