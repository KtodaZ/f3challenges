'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { TrophyTierDef } from '@/types'

/**
 * A trophy tier's mark — real artwork when the challenge ships some, the tier
 * emoji otherwise.
 *
 * The fallback is deliberately belt-and-braces: no `iconUrl` renders the emoji,
 * and an `iconUrl` that 404s or fails to decode swaps back to the emoji at
 * runtime. That means a challenge can declare artwork before the file lands
 * without ever showing a broken image.
 *
 * Only use this where the mark renders at ~32px or larger. Below that an
 * illustration turns to mush and the emoji genuinely reads better — the tiny
 * rung chips on TrophyTierBar stay on emoji for that reason.
 */

interface TrophyIconProps {
  tier: TrophyTierDef
  /** Rendered edge length in px. Also the emoji font-size fallback. */
  size: number
  className?: string
}

export function TrophyIcon({ tier, size, className }: TrophyIconProps) {
  const [failed, setFailed] = useState(false)

  if (tier.iconUrl && !failed) {
    // A plain <img> on purpose: this is a fixed-size local asset that needs its
    // own onError path to fall back to the emoji, which next/image's error
    // handling would swallow.
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={tier.iconUrl}
        alt={tier.label}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className={cn('object-contain select-none', className)}
        style={{ width: size, height: size }}
        draggable={false}
      />
    )
  }

  return (
    <span
      role="img"
      aria-label={tier.label}
      className={cn('leading-none select-none', className)}
      style={{ fontSize: size * 0.8, lineHeight: 1 }}
    >
      {tier.emoji}
    </span>
  )
}
