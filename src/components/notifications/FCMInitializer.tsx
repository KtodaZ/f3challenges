'use client'

import { useFCM } from '@/hooks/useFCM'
import { useUser } from '@/contexts/UserContext'
import { useEffect } from 'react'

/**
 * Mounts the FCM foreground message handler and requests notification
 * permission once the user is known. Renders nothing — side-effects only.
 */
export function FCMInitializer() {
  const { currentUser } = useUser()
  const { permissionStatus, requestPermission } = useFCM()

  useEffect(() => {
    if (!currentUser) return
    if (permissionStatus === 'default') {
      // Request silently on first load after user is set
      requestPermission(currentUser.id)
    }
  }, [currentUser, permissionStatus, requestPermission])

  return null
}
