'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import {
  getCurrentUserId, setCurrentUserId, clearCurrentUserId,
  getCachedUser, setCachedUser, clearCachedUser,
} from '@/lib/storage'
import { getUser, subscribeToUsers } from '@/lib/firestore'
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
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [allUsers, setAllUsers]       = useState<User[]>([])
  const [loading, setLoading]         = useState(true)

  // Subscribe to all users (real-time)
  useEffect(() => {
    const unsub = subscribeToUsers(users => {
      setAllUsers(users.sort((a, b) => a.displayName.localeCompare(b.displayName)))
    })
    return unsub
  }, [])

  // Restore session — use cache for instant load, then refresh from Firestore in background
  useEffect(() => {
    const id = getCurrentUserId()
    if (!id) { setLoading(false); return }

    // Show cached user immediately so the app doesn't flash to onboarding
    const cached = getCachedUser<User>()
    if (cached && cached.id === id) {
      setCurrentUser(cached)
      setLoading(false)
    }

    // Refresh from Firestore in background
    getUser(id).then(u => {
      if (u) {
        setCurrentUser(u)
        setCachedUser(u)
      } else if (!cached) {
        // User genuinely doesn't exist (e.g. cleared DB) — reset
        clearCurrentUserId()
        clearCachedUser()
      }
      setLoading(false)
    })
  }, [])

  function login(user: User) {
    setCurrentUserId(user.id)
    setCachedUser(user)
    setCurrentUser(user)
  }

  function logout() {
    clearCurrentUserId()
    clearCachedUser()
    setCurrentUser(null)
  }

  function refreshCurrentUser() {
    if (!currentUser) return
    getUser(currentUser.id).then(u => {
      if (u) {
        setCurrentUser(u)
        setCachedUser(u)
      }
    })
  }

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
