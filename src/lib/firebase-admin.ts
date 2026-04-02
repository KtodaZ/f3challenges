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

// Named exports for convenience (lazy via getters)
export const adminDb        = new Proxy({} as Firestore,        { get: (_, p) => getAdminDb()[p as keyof Firestore] })
export const adminMessaging = new Proxy({} as Messaging, { get: (_, p) => getAdminMessaging()[p as keyof Messaging] })
