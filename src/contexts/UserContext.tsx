'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import {
  getCurrentUserId, setCurrentUserId, clearCurrentUserId,
  getCachedUser, setCachedUser, clearCachedUser,
  setOnboardingComplete,
} from '@/lib/storage'
import { getUser, subscribeToUsers, updateUser } from '@/lib/firestore'
import { consumeClaimParam } from '@/lib/migration'
import { useRegion } from '@/contexts/RegionContext'
import type { User } from '@/types'

interface UserContextValue {
  currentUser: User | null
  allUsers: User[]
  loading: boolean
  login: (user: User) => void
  logout: () => void
  refreshCurrentUser: () => void
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ children }: { children: ReactNode }) {
  const { regionId, ready: regionReady, setRegion, clearRegion } = useRegion()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [allUsers, setAllUsers]       = useState<User[]>([])
  const [loading, setLoading]         = useState(true)

  // Subscribe to this region's roster (real-time). Scoping here is what keeps
  // every downstream consumer of `allUsers` — mentions, the name picker, the
  // callout modal, leaderboard rows, group-completion counts — region-correct
  // without each of them knowing regions exist.
  useEffect(() => {
    if (!regionReady) return
    const unsub = subscribeToUsers(regionId, users => {
      setAllUsers(users.sort((a, b) => a.displayName.localeCompare(b.displayName)))
    })
    return unsub
  }, [regionId, regionReady])

  // Restore session — use cache for instant load, then refresh from Firestore in background
  useEffect(() => {
    // A `?claim=` handover from the old domain wins over whatever this origin
    // has stored: it's how a migrating PAX arrives already signed in instead of
    // re-picking their name. Read here rather than in a separate provider
    // because child effects run before parent ones — this is the first thing
    // that touches the session.
    const claimedId = consumeClaimParam()
    const id = claimedId ?? getCurrentUserId()
    if (!id) { setLoading(false); return }

    // Show cached user immediately so the app doesn't flash to onboarding.
    // Skipped for a claim — the cache belongs to whoever used this origin last.
    const cached = claimedId ? null : getCachedUser<User>()
    if (cached && cached.id === id) {
      setCurrentUser(cached)
      setLoading(false)
    }

    // Refresh from Firestore in background
    getUser(id).then(u => {
      if (u) {
        setCurrentUser(u)
        setCachedUser(u)
        if (claimedId) {
          // Land them fully signed in, in their own region, past onboarding.
          setCurrentUserId(u.id)
          setOnboardingComplete()
          if (u.regionId) setRegion(u.regionId)
          // Tells the old origin it may retire its push registration.
          if (!u.migratedAt) {
            const migratedAt = new Date().toISOString()
            updateUser(u.id, { migratedAt }).catch(() => {})
          }
        }
      } else if (!cached) {
        // User genuinely doesn't exist (e.g. cleared DB) — reset
        clearCurrentUserId()
        clearCachedUser()
      }
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The user doc is the authority on which region they're in — an ?region=
  // link or a stale localStorage value loses to it. Guarded on inequality so
  // this can't ping-pong with the region provider.
  const userRegionId = currentUser?.regionId
  useEffect(() => {
    if (regionReady && userRegionId && userRegionId !== regionId) setRegion(userRegionId)
  }, [userRegionId, regionId, regionReady, setRegion])

  function login(user: User) {
    setCurrentUserId(user.id)
    setCachedUser(user)
    setCurrentUser(user)
    if (user.regionId) setRegion(user.regionId)
  }

  function logout() {
    clearCurrentUserId()
    clearCachedUser()
    // Drop the region too, so re-onboarding on a shared device can land
    // somewhere else instead of silently inheriting the last PAX's region.
    // Must go through the context, not just localStorage — otherwise the
    // provider stays `chosen: true` and onboarding skips the region step.
    clearRegion()
    setCurrentUser(null)
  }

  // Stable identity so callers can safely list it as an effect/callback dep.
  const currentUserId = currentUser?.id
  const refreshCurrentUser = useCallback(() => {
    if (!currentUserId) return
    getUser(currentUserId).then(u => {
      if (u) {
        setCurrentUser(u)
        setCachedUser(u)
      }
    })
  }, [currentUserId])

  return (
    <UserContext.Provider value={{ currentUser, allUsers, loading, login, logout, refreshCurrentUser }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used within UserProvider')
  return ctx
}
