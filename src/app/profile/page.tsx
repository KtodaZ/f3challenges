'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'

export default function ProfileRedirect() {
  const { currentUser, loading } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!currentUser) { router.replace('/onboarding'); return }
    router.replace(`/profile/${currentUser.id}`)
  }, [currentUser, loading, router])

  return (
    <div className="flex items-center justify-center min-h-dvh">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
