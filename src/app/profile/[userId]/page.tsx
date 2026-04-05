'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useUser } from '@/contexts/UserContext'
import { getUser } from '@/lib/firestore'
import { ProfileView } from '@/components/profile/ProfileView'
import type { User } from '@/types'

export default function ProfilePage() {
  const params = useParams()
  const userId = params.userId as string
  const { allUsers } = useUser()

  // Try allUsers cache first, fall back to fetch
  const [profileUser, setProfileUser] = useState<User | null>(
    allUsers.find(u => u.id === userId) ?? null
  )
  const [loading, setLoading] = useState(!profileUser)

  useEffect(() => {
    const cached = allUsers.find(u => u.id === userId)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cached) { setProfileUser(cached); setLoading(false); return }
    getUser(userId).then(u => { setProfileUser(u); setLoading(false) })
  }, [userId, allUsers])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!profileUser) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <p className="text-zinc-500">User not found.</p>
      </div>
    )
  }

  return <ProfileView profileUser={profileUser} />
}
