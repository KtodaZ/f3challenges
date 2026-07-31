'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { getStoredRegionId, setStoredRegionId, clearStoredRegionId, getCachedUser } from '@/lib/storage'
import { DEFAULT_REGION_ID, isValidRegionId, resolveRegion } from '@/lib/challenges'
import { setActiveRegionId } from '@/lib/firestore'
import type { Region, User } from '@/types'

interface RegionContextValue {
  /** Always a valid region id — falls back to Bedrock rather than rendering
   *  an app with no region. */
  regionId: string
  region: Region
  /** False when we fell back to the default because nothing told us otherwise.
   *  Onboarding uses this to decide whether to ask which region. */
  regionChosen: boolean
  /** True once localStorage has been read. Consumers that query by region
   *  should wait for this, otherwise they fire a Bedrock query on mount and a
   *  Sactown one a tick later. */
  ready: boolean
  setRegion: (regionId: string) => void
  /** Forget the chosen region (logout). Resets in-memory state too, so
   *  re-onboarding on a shared device asks again instead of silently
   *  inheriting the last PAX's region. */
  clearRegion: () => void
}

const RegionContext = createContext<RegionContextValue | null>(null)

/**
 * Resolves the region for this device, in priority order:
 *   1. `?region=` on the URL — the invite link, and it sticks
 *   2. localStorage, set the last time a region was chosen
 *   3. the cached user's regionId — covers PAX who onboarded before regions
 *   4. Bedrock
 *
 * Runs in an effect rather than a render-phase initializer: localStorage and
 * window.location don't exist during SSR, and resolving them inline would
 * prerender Bedrock and hydrate Sactown. The `ready` flag lets consumers hold
 * off instead, which the existing loading spinner already covers.
 */
function resolveRegionId(): { regionId: string; chosen: boolean } {
  const param = new URLSearchParams(window.location.search).get('region')
  if (isValidRegionId(param)) return { regionId: param!, chosen: true }

  const stored = getStoredRegionId()
  if (isValidRegionId(stored)) return { regionId: stored!, chosen: true }

  const cached = getCachedUser<User>()
  if (isValidRegionId(cached?.regionId)) return { regionId: cached!.regionId!, chosen: true }

  return { regionId: DEFAULT_REGION_ID, chosen: false }
}

export function RegionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({
    regionId: DEFAULT_REGION_ID,
    chosen: false,
    ready: false,
  })

  useEffect(() => {
    const { regionId, chosen } = resolveRegionId()
    if (chosen) setStoredRegionId(regionId)
    setActiveRegionId(regionId)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ regionId, chosen, ready: true })
  }, [])

  const setRegion = useCallback((regionId: string) => {
    if (!isValidRegionId(regionId)) return
    setStoredRegionId(regionId)
    // Keep the write path in lock step with the read path, so a doc created
    // right after a region switch lands in the region the user is looking at.
    setActiveRegionId(regionId)
    setState({ regionId, chosen: true, ready: true })
  }, [])

  const clearRegion = useCallback(() => {
    clearStoredRegionId()
    setActiveRegionId(DEFAULT_REGION_ID)
    setState({ regionId: DEFAULT_REGION_ID, chosen: false, ready: true })
  }, [])

  return (
    <RegionContext.Provider
      value={{
        regionId: state.regionId,
        region: resolveRegion(state.regionId),
        regionChosen: state.chosen,
        ready: state.ready,
        setRegion,
        clearRegion,
      }}
    >
      {children}
    </RegionContext.Provider>
  )
}

export function useRegion() {
  const ctx = useContext(RegionContext)
  if (!ctx) throw new Error('useRegion must be used within RegionProvider')
  return ctx
}
