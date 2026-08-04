'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { getStoredRegionId, setStoredRegionId, clearStoredRegionId, getCachedUser } from '@/lib/storage'
import { DEFAULT_REGION_ID, isValidRegionId, resolveRegion } from '@/lib/challenges'
import { setActiveRegionId, setRegionWriteScope } from '@/lib/firestore'
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
  /**
   * A superadmin previewing another region's app exactly as its PAX see it.
   * Null when off. While set, `regionId` reports the previewed region and
   * logging is off — the signed-in PAX belongs elsewhere, so a log would be
   * stamped with a region they aren't in and counted for a crew they aren't on.
   */
  viewingAs: string | null
  setViewingAs: (regionId: string | null) => void
  /** True while previewing another region. Controls that *log* should be
   *  disabled on this — the write helpers refuse regardless, but a disabled
   *  button explains itself and a rejected promise doesn't. */
  readOnly: boolean
  /**
   * True while previewing a region this viewer may not post in. Feed controls
   * gate on this rather than `readOnly`: a superadmin visiting another region
   * can post, comment and react there, because a post is attributed to whoever
   * wrote it and nothing about it counts toward a challenge.
   */
  socialReadOnly: boolean
  /**
   * Opens feed writes while previewing. Called by `AdminModeProvider` once the
   * server has confirmed the viewer is a superadmin — this provider has no way
   * to know that itself, and must not assume it: preview restores from
   * sessionStorage before anyone has been checked, so it starts closed and is
   * opened afterwards, never the other way round.
   */
  grantSocialWrites: (allowed: boolean) => void
}

/** sessionStorage, not localStorage: previewing another region should end when
 *  the tab does, rather than leaving someone silently parked in Sactown. */
const VIEW_AS_KEY = 'f3_view_as_region'

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
  const [viewingAs, setViewingAsState] = useState<string | null>(null)
  const [socialAllowed, setSocialAllowed] = useState(false)

  useEffect(() => {
    const { regionId, chosen } = resolveRegionId()
    const preview = sessionStorage.getItem(VIEW_AS_KEY)
    const active = isValidRegionId(preview) ? preview! : regionId

    if (chosen) setStoredRegionId(regionId)
    setActiveRegionId(active)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ regionId, chosen, ready: true })
    // Restores an in-progress preview across a reload within the same tab.
    if (active !== regionId) setViewingAsState(active)
  }, [])

  // The one place the write scope is decided, so the two inputs it depends on
  // can't drift apart. An effect rather than a line in each handler: the grant
  // arrives asynchronously from the admin check, and no write can happen
  // between a handler and the effect that follows it.
  useEffect(() => {
    setRegionWriteScope(
      viewingAs === null ? 'own' : socialAllowed ? 'social' : 'readonly'
    )
  }, [viewingAs, socialAllowed])

  const setRegion = useCallback((regionId: string) => {
    if (!isValidRegionId(regionId)) return
    setStoredRegionId(regionId)
    // Changing your actual region ends any preview. Without this, `setRegion`
    // (from login, or a ?claim= handover) would move the ambient write region
    // while `viewingAs` still drove reads and `readOnly` stayed stuck on —
    // reads showing one region, writes stamping another.
    sessionStorage.removeItem(VIEW_AS_KEY)
    setViewingAsState(null)
    // Keep the write path in lock step with the read path, so a doc created
    // right after a region switch lands in the region the user is looking at.
    setActiveRegionId(regionId)
    setState({ regionId, chosen: true, ready: true })
  }, [])

  /**
   * Enter or leave admin preview of another region.
   *
   * Side effects run here, in the event handler, not inside the state updater —
   * React may invoke an updater more than once, and writing sessionStorage or
   * flipping the module-level write lock twice is not something to leave to
   * chance.
   */
  const setViewingAs = useCallback((next: string | null) => {
    if (next !== null && !isValidRegionId(next)) return

    // state.regionId is the provider's own answer for "my region"; deriving it
    // from storage as well gave two sources that could disagree.
    const own = state.regionId
    // Previewing your own region isn't a preview. Letting it through would show
    // the read-only banner while writes stayed enabled — the one combination
    // that actively misleads.
    if (next === own) next = null
    const active = next ?? own

    if (next) sessionStorage.setItem(VIEW_AS_KEY, next)
    else sessionStorage.removeItem(VIEW_AS_KEY)

    setActiveRegionId(active)
    setViewingAsState(next)
  }, [state.regionId])

  const grantSocialWrites = useCallback((allowed: boolean) => {
    setSocialAllowed(allowed)
  }, [])

  const clearRegion = useCallback(() => {
    clearStoredRegionId()
    sessionStorage.removeItem(VIEW_AS_KEY)
    setActiveRegionId(DEFAULT_REGION_ID)
    setViewingAsState(null)
    // Whoever signs in next is a different person until proven otherwise.
    setSocialAllowed(false)
    setState({ regionId: DEFAULT_REGION_ID, chosen: false, ready: true })
  }, [])

  return (
    <RegionContext.Provider
      value={{
        // While previewing, every consumer sees the previewed region — that is
        // the whole point: the app should look exactly as its PAX see it.
        regionId: viewingAs ?? state.regionId,
        region: resolveRegion(viewingAs ?? state.regionId),
        regionChosen: state.chosen,
        ready: state.ready,
        setRegion,
        clearRegion,
        viewingAs,
        setViewingAs,
        readOnly: viewingAs !== null,
        socialReadOnly: viewingAs !== null && !socialAllowed,
        grantSocialWrites,
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
