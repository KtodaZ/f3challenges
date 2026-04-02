'use client'

import { useState, useEffect } from 'react'
import { getCurrentUserId, setCurrentUserId, clearCurrentUserId } from '@/lib/storage'
import { getUser } from '@/lib/firestore'
import type { User } from '@/types'

export function useCurrentUser() {
  const [userId, setUserId]   = useState<string | null>(null)
  const [user, setUser]       = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const id = getCurrentUserId()
    setUserId(id)
    if (!id) { setLoading(false); return }

    getUser(id).then(u => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  function login(id: string, userData: User) {
    setCurrentUserId(id)
    setUserId(id)
    setUser(userData)
  }

  function logout() {
    clearCurrentUserId()
    setUserId(null)
    setUser(null)
  }

  function refreshUser() {
    if (!userId) return
    getUser(userId).then(setUser)
  }

  return { userId, user, loading, login, logout, refreshUser }
}
