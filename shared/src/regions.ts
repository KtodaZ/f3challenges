// ─── Region Definitions ───────────────────────────────────────────────────────
// Single source of truth for the F3 regions using this app.
//
// To add a new region:
//   1. Append one object to REGIONS below.
//   2. Give it at least one challenge (set `regionIds` on a CHALLENGES entry).
//
// Static data, not a Firestore collection — same call as challenges. Keeps
// Cloud Functions able to resolve regions from the bundled @f3-bedrock/shared
// import rather than an extra read on every scheduled run.

export interface Region {
  id: string
  /** Full name, e.g. 'F3 Bedrock' — used in headings and push copy. */
  name: string
  /** Bare name, e.g. 'Bedrock' — used inline in sentences. */
  shortName: string
  /** IANA zone. Everything is Pacific today; the field exists so the first
   *  non-PT region is a data change rather than a migration. Note that the
   *  date helpers in challenges.ts still hardcode PT — see getTodayPT(). */
  timezone: string
}

export const REGIONS: Region[] = [
  {
    id: 'bedrock',
    name: 'F3 Bedrock',
    shortName: 'Bedrock',
    timezone: 'America/Los_Angeles',
  },
  {
    id: 'sactown',
    name: 'F3 Sactown',
    shortName: 'Sactown',
    timezone: 'America/Los_Angeles',
  },
]

/** The original region. Anything created before regions existed belongs here,
 *  and any challenge without an explicit `regionIds` is Bedrock-only. */
export const DEFAULT_REGION_ID = 'bedrock'

export function getRegionById(id: string | undefined | null): Region | undefined {
  if (!id) return undefined
  return REGIONS.find(r => r.id === id)
}

/** Region for an id, falling back to Bedrock so a bad/missing id never renders
 *  an empty app. Use where you need a Region and can't handle undefined. */
export function resolveRegion(id: string | undefined | null): Region {
  return getRegionById(id) ?? REGIONS.find(r => r.id === DEFAULT_REGION_ID)!
}

export function isValidRegionId(id: string | undefined | null): boolean {
  return getRegionById(id) !== undefined
}
