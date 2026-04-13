'use client'

import { Button } from '@/components/ui/Button'

interface WelcomeStepProps {
  onNext: () => void
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-between px-6 py-12">
      {/* Logo area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
        {/* Shield / logo */}
        <div className="relative w-32 h-36 flex items-center justify-center">
          {/* Shield SVG shape */}
          <svg viewBox="0 0 128 144" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 w-full h-full">
            <path
              d="M64 4L8 28V72C8 104 34 130 64 140C94 130 120 104 120 72V28L64 4Z"
              fill="#18181b"
              stroke="#f97316"
              strokeWidth="4"
            />
          </svg>
          {/* F3 text inside shield */}
          <span className="relative z-10 text-4xl font-black text-orange-500 tracking-tight leading-none">
            F3
          </span>
        </div>

        <div className="space-y-1">
          <p className="text-3xl font-black text-white tracking-widest uppercase">BEDROCK</p>
          <p className="text-sm font-medium text-orange-400 tracking-wider uppercase">Monthly Challenge</p>
        </div>

        {/* Divider */}
        <div className="w-16 h-px bg-orange-500/40" />

        {/* Challenge name */}
        <div className="space-y-2">
          <p className="text-xl font-bold text-white">The Merkin Gauntlet</p>
          <p className="text-sm text-zinc-400">April 2026</p>
        </div>

        {/* Tagline */}
        <p className="text-base text-zinc-300 leading-relaxed max-w-xs text-center">
          Hold each other accountable.<br />
          Log daily. Conquer together.
        </p>
      </div>

      {/* CTA */}
      <div className="w-full max-w-sm space-y-4">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={onNext}
          className="text-lg py-4"
        >
          Let&apos;s Go 💪
        </Button>
        <p className="text-center text-xs text-zinc-600">
          Fitness accountability for F3 Bedrock PAX
        </p>
      </div>
    </div>
  )
}
