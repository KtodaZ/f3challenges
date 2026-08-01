import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import type { User } from '@/types'

/**
 * Attaches an FCM token to a PAX so pushes reach their device.
 *
 * This is **validation, not authorization** — and the distinction matters.
 * PAX are unauthenticated (identity is a user id in localStorage), so there is
 * no proof that whoever called this owns the account they named. The checks
 * below reject nonexistent and archived users; they cannot stop someone from
 * attaching a token to another active PAX and receiving their notifications.
 * Closing that needs PAX auth — see the Phase 3 notes in docs/MULTI_REGION.md.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, token } = await req.json()
    if (typeof userId !== 'string' || typeof token !== 'string' || !userId || !token) {
      return NextResponse.json({ error: 'userId and token required' }, { status: 400 })
    }

    // Read before write: a blind update() would happily attach push state to a
    // user id that was never real, and throws on a missing doc anyway.
    const ref = adminDb.collection('users').doc(userId)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Unknown userId' }, { status: 404 })
    }
    if ((snap.data() as User).status === 'archived') {
      return NextResponse.json({ error: 'Account is archived' }, { status: 403 })
    }

    await ref.update({ fcmTokens: FieldValue.arrayUnion(token) })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[FCM register]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
