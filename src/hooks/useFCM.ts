'use client'

import { useEffect, useState } from 'react'
import { onMessage } from 'firebase/messaging'
import { toast } from 'sonner'
import { getMessagingInstance } from '@/lib/firebase'
import { sendFCMConfigToServiceWorker, requestNotificationPermission, registerServiceWorker } from '@/lib/fcm'

export interface UseFCMReturn {
  permissionStatus: NotificationPermission | 'unsupported'
  requestPermission: (userId: string) => Promise<boolean>
}

export function useFCM(): UseFCMReturn {
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>(
    () => {
      if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
      return Notification.permission
    }
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Register SW explicitly so Chrome sees it for PWA install prompt,
    // then send Firebase config to it.
    registerServiceWorker().then(() => sendFCMConfigToServiceWorker())

    // Register foreground message handler
    let unsubscribe: (() => void) | undefined

    getMessagingInstance().then(messaging => {
      if (!messaging) return

      unsubscribe = onMessage(messaging, payload => {
        toast(payload.notification?.title ?? 'F3 Bedrock', {
          description: payload.notification?.body,
        })
      })
    })

    return () => {
      unsubscribe?.()
    }
  }, [])

  const requestPermission = async (userId: string): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermissionStatus('unsupported')
      return false
    }

    const token = await requestNotificationPermission(userId)
    setPermissionStatus(Notification.permission)
    return token !== null
  }

  return { permissionStatus, requestPermission }
}
