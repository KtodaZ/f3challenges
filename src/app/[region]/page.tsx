import { redirect } from 'next/navigation'
import { REGIONS } from '@/lib/challenges'

/**
 * Pretty invite links — `/bedrock`, `/sactown`.
 *
 * Short enough to say out loud at a workout, which the old
 * `/onboarding?region=sactown` was not. The mechanism underneath is unchanged:
 * this segment just redirects to that URL, and `RegionContext` picks the region
 * off the query string exactly as before. The long form still works.
 *
 * Prerendered from `REGIONS` with `dynamicParams = false`, so a region added to
 * `shared/src/regions.ts` gets its link for free, and every other top-level path
 * still falls through to the normal 404 instead of this redirect.
 */
export const dynamicParams = false

export function generateStaticParams() {
  return REGIONS.map(region => ({ region: region.id }))
}

export default async function RegionInvitePage({
  params,
}: {
  params: Promise<{ region: string }>
}) {
  const { region } = await params
  redirect(`/onboarding?region=${region}`)
}
