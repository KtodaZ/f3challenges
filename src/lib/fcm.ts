'use client'

import { getToken } from 'firebase/messaging'
import { getMessagingInstance } from './firebase'

/**
 * Requests notification permission, retrieves the FCM token, and registers it
 * with the backend. Returns the token on success, null on failure or denial.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    console.log('[SW] registered:', registration.scope)
    return registration
  } catch (err) {
    console.error('[SW] registration failed:', err)
    return null
  }
}

export async function requestNotificationPermission(userId: string): Promise<string | null> {
  if (typeof window === 'undefined') return null

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  const messaging = await getMessagingInstance()
  if (!messaging) return null

  try {
    const registration = await registerServiceWorker() ?? await navigator.serviceWorker.ready

    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    })

    if (!token) return null

    await fetch('/api/fcm/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, token }),
    })

    return token
  } catch (err) {
    console.error('[FCM] Failed to get token:', err)
    return null
  }
}

/**
 * Posts the Firebase config to the active service worker so it can initialize
 * the Firebase app for background message handling.
 */
export function sendFCMConfigToServiceWorker(): void {
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
}
