'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { getCurrentUserId, setCurrentUserId, clearCurrentUserId } from '@/lib/storage'
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

  // Subscribe to all users (real-time, ~20 users so cheap)
  useEffect(() => {
    const unsub = subscribeToUsers(users => {
      setAllUsers(users.sort((a, b) => a.displayName.localeCompare(b.displayName)))
    })
    return unsub
  }, [])

  // Restore session from localStorage
  useEffect(() => {
    const id = getCurrentUserId()
    if (!id) { setLoading(false); return }
    getUser(id).then(u => {
      setCurrentUser(u)
      setLoading(false)
    })
  }, [])

  function login(user: User) {
    setCurrentUserId(user.id)
    setCurrentUser(user)
  }

  function logout() {
    clearCurrentUserId()
    setCurrentUser(null)
  }

  function refreshCurrentUser() {
    if (!currentUser) return
    getUser(currentUser.id).then(u => {
      if (u) setCurrentUser(u)
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
