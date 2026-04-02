'use client'

import { cn } from '@/lib/utils'
import type { OnboardingStep } from '@/types'

interface StepDotsProps {
  steps: OnboardingStep[]
  currentStep: OnboardingStep
}

export function StepDots({ steps, currentStep }: StepDotsProps) {
  const currentIndex = steps.indexOf(currentStep)

  return (
    <div className="flex items-center justify-center gap-2" role="progressbar" aria-valuenow={currentIndex + 1} aria-valuemax={steps.length}>
      {steps.map((step, i) => (
        <div
          key={step}
          className={cn(
            'rounded-full transition-all duration-300',
            i === currentIndex
              ? 'w-6 h-2 bg-orange-500'
              : i < currentIndex
              ? 'w-2 h-2 bg-orange-500/50'
              : 'w-2 h-2 bg-zinc-700'
          )}
        />
      ))}
    </div>
  )
}
