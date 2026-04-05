// Firebase Cloud Messaging Service Worker
// This file must be at the root of the public directory.
// Config values are injected at runtime via the /api/sw-config endpoint.

const DBG = 'https://example.ngrok-free.app'
function dbg(label, data) {
  fetch(DBG, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label, src: 'SW', data }) }).catch(() => {})
}

// Required for Chrome's PWA install prompt — without a fetch handler Chrome
// will not consider this a qualifying service worker for installability.
self.addEventListener('fetch', () => {})

// Immediately claim all open pages so navigator.serviceWorker.controller
// is non-null on first install without requiring a page reload.
self.addEventListener('activate', event => {
  dbg('state', { event: 'activate', claiming: true })
  event.waitUntil(self.clients.claim())
})


importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

// Config will be set by the client after registration
self.__FCM_CONFIG__ = null

self.addEventListener('message', event => {
  if (event.data?.type === 'FCM_CONFIG') {
    dbg('fn-entry', { event: 'message:FCM_CONFIG', alreadyInit: !!self.__FCM_CONFIG__, hasApiKey: !!event.data.config?.apiKey })
    if (!self.__FCM_CONFIG__) {
      self.__FCM_CONFIG__ = event.data.config
      firebase.initializeApp(event.data.config)
      const messaging = firebase.messaging()

      // When Firebase is initialized (warm SW), suppress the browser's default
      // notification display and show our own with icon/vibration customization.
      // On cold SW starts (no FCM_CONFIG yet), the browser auto-displays from
      // the notification payload — no fallback handler needed.
      messaging.onBackgroundMessage(payload => {
        const title = payload.notification?.title ?? 'F3 Bedrock'
        const body  = payload.notification?.body  ?? ''
        const icon  = payload.notification?.icon  ?? '/icons/icon-192.png'
        const link  = payload.data?.link ?? payload.fcmOptions?.link ?? '/'
        dbg('fn-entry', { event: 'onBackgroundMessage', title, body })
        self.registration.showNotification(title, {
          body,
          icon,
          badge:   '/icons/icon-192.png',
          data:    { url: link },
          vibrate: [200, 100, 200],
        })
        dbg('fn-exit', { event: 'showNotification', title })
      })

      dbg('fn-exit', { event: 'message:FCM_CONFIG', initialized: true })
    }
  }
})

// iOS does not auto-display from the notification key — the SW must call
// showNotification() explicitly. This fallback handles cold SW starts where
// Firebase hasn't been initialized yet (no FCM_CONFIG from the client page).
// When Firebase IS initialized, __FCM_CONFIG__ is set and we return early so
// onBackgroundMessage handles it exclusively — no duplicates.
self.addEventListener('push', event => {
  if (self.__FCM_CONFIG__) return
  if (!event.data) return

  let payload = {}
  try { payload = event.data.json() } catch { return }

  const title = payload.notification?.title ?? 'F3 Bedrock'
  const body  = payload.notification?.body  ?? ''
  const icon  = payload.notification?.icon  ?? '/icons/icon-192.png'
  const link  = payload.data?.link ?? '/'

  dbg('fn-entry', { event: 'push:cold-sw-fallback', title, body })
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge:   '/icons/icon-192.png',
      data:    { url: link },
      vibrate: [200, 100, 200],
    })
  )
})

self.addEventListener('notificationclick', event => {
  dbg('fn-entry', { event: 'notificationclick', url: event.notification.data?.url })
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
