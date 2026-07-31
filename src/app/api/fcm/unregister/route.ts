import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

// Removes one FCM token from a user. Used by the domain migration to retire the
// old origin's push registration — without this the old install keeps receiving
// notifications alongside the new one.

export async function POST(req: NextRequest) {
  try {
    const { userId, token } = await req.json()
    if (!userId || !token) {
      return NextResponse.json({ error: 'userId and token required' }, { status: 400 })
    }

    await adminDb.collection('users').doc(userId).update({
      fcmTokens: FieldValue.arrayRemove(token),
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[FCM unregister]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
