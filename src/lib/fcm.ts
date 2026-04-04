'use client'

import { getToken } from 'firebase/messaging'
import { getMessagingInstance } from './firebase'

const DBG = process.env.NEXT_PUBLIC_DEBUG_URL
function dbg(label: string, data: unknown) {
  if (!DBG) return
  fetch(DBG, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label, src: 'fcm.ts', data }) }).catch(() => {})
}

/**
 * Requests notification permission, retrieves the FCM token, and registers it
 * with the backend. Returns the token on success, null on failure or denial.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    dbg('fn-exit', { fn: 'registerServiceWorker', scope: registration.scope, state: registration.active?.state ?? 'no-active' })
    console.log('[SW] registered:', registration.scope)
    return registration
  } catch (err) {
    dbg('error', { fn: 'registerServiceWorker', err: String(err) })
    console.error('[SW] registration failed:', err)
    return null
  }
}

export async function requestNotificationPermission(userId: string): Promise<string | null> {
  if (typeof window === 'undefined') return null

  dbg('fn-entry', { fn: 'requestNotificationPermission', userId, currentPermission: Notification.permission })

  const permission = await Notification.requestPermission()
  dbg('branch', { fn: 'requestNotificationPermission', permissionResult: permission })
  if (permission !== 'granted') return null

  const messaging = await getMessagingInstance()
  if (!messaging) {
    dbg('error', { fn: 'requestNotificationPermission', reason: 'getMessagingInstance returned null' })
    return null
  }

  try {
    const registration = await registerServiceWorker() ?? await navigator.serviceWorker.ready
    dbg('state', { fn: 'requestNotificationPermission', swScope: registration.scope, swState: registration.active?.state })

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
    dbg('state', { fn: 'requestNotificationPermission', vapidKeyPresent: !!vapidKey, vapidKeyPrefix: vapidKey?.slice(0, 10) })

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    })

    dbg('state', { fn: 'requestNotificationPermission', tokenObtained: !!token, tokenPrefix: token?.slice(0, 20) })

    if (!token) return null

    const res = await fetch('/api/fcm/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, token }),
    })
    dbg('fn-exit', { fn: 'requestNotificationPermission', registerStatus: res.status, tokenPrefix: token.slice(0, 20) })

    return token
  } catch (err) {
    dbg('error', { fn: 'requestNotificationPermission', err: String(err) })
    console.error('[FCM] Failed to get token:', err)
    return null
  }
}

/**
 * Posts the Firebase config to the active service worker so it can initialize
 * the Firebase app for background message handling.
 */
export function sendFCMConfigToServiceWorker(): void {
  const hasController = !!navigator.serviceWorker?.controller
  dbg('fn-entry', { fn: 'sendFCMConfigToServiceWorker', hasController })

  if (typeof navigator === 'undefined' || !navigator.serviceWorker?.controller) return

  navigator.serviceWorker.controller.postMessage({
    type: 'FCM_CONFIG',
    config: {
      apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    },
  })
  dbg('fn-exit', { fn: 'sendFCMConfigToServiceWorker', sent: true })
}
