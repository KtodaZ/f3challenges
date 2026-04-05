import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getMessaging, type Messaging } from 'firebase-admin/messaging'

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0]
  return initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

// Lazy getters — only initialize when first accessed (not at module load time)
export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp())
}

export function getAdminMessaging(): Messaging {
  return getMessaging(getAdminApp())
}

// Named exports for convenience (lazy via getters).
// Methods must be bound to the real instance so that internal `this` mutations
// (e.g. FCM caching urlPath on `this`) write and read from the same object.
function proxyInstance<T extends object>(getInstance: () => T): T {
  return new Proxy({} as T, {
    get: (_, p) => {
      const instance = getInstance()
      const value = instance[p as keyof T]
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(instance) : value
    },
  })
}

export const adminDb        = proxyInstance(getAdminDb)
export const adminMessaging = proxyInstance(getAdminMessaging)
