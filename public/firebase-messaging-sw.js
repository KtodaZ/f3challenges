// Firebase Cloud Messaging Service Worker
// This file must be at the root of the public directory.
// Config values are injected at runtime via the /api/sw-config endpoint.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

// Config will be set by the client after registration
self.__FCM_CONFIG__ = null

self.addEventListener('message', event => {
  if (event.data?.type === 'FCM_CONFIG') {
    if (!self.__FCM_CONFIG__) {
      self.__FCM_CONFIG__ = event.data.config
      firebase.initializeApp(event.data.config)
      const messaging = firebase.messaging()

      messaging.onBackgroundMessage(payload => {
        const { title, body, icon } = payload.notification ?? {}
        self.registration.showNotification(title ?? 'F3 Bedrock', {
          body: body ?? '',
          icon: icon ?? '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          data: payload.data,
          vibrate: [200, 100, 200],
        })
      })
    }
  }
})

self.addEventListener('notificationclick', event => {
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
