'use client'

import { useFCM } from '@/hooks/useFCM'
import { useUser } from '@/contexts/UserContext'
import { useEffect } from 'react'

const DBG = process.env.NEXT_PUBLIC_DEBUG_URL
function dbg(label: string, data: unknown) {
  if (!DBG) return
  fetch(DBG, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label, src: 'FCMInitializer', data }) }).catch(() => {})
}

/**
 * Mounts the FCM foreground message handler and requests notification
 * permission once the user is known. Renders nothing — side-effects only.
 */
export function FCMInitializer() {
  const { currentUser } = useUser()
  const { permissionStatus, requestPermission } = useFCM()

  useEffect(() => {
    dbg('state', { permissionStatus, userId: currentUser?.id ?? null })
    if (!currentUser) return
    // 'default' → prompt the user; 'granted' → silently refresh/register the token
    if (permissionStatus === 'default' || permissionStatus === 'granted') {
      dbg('branch', { action: 'calling requestPermission', permissionStatus, userId: currentUser.id })
      requestPermission(currentUser.id)
    }
  }, [currentUser, permissionStatus, requestPermission])

  return null
}
