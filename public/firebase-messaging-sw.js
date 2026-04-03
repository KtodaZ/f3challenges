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

      messaging.onBackgroundMessage(payload => {
        const { title, body, icon } = payload.notification ?? {}
        dbg('fn-entry', { event: 'onBackgroundMessage', title, body, hasData: !!payload.data })
        self.registration.showNotification(title ?? 'F3 Bedrock', {
          body: body ?? '',
          icon: icon ?? '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          data: payload.data,
          vibrate: [200, 100, 200],
        })
        dbg('fn-exit', { event: 'showNotification', title })
      })

      dbg('fn-exit', { event: 'message:FCM_CONFIG', initialized: true })
    }
  }
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
