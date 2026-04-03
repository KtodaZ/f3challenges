import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

export async function POST(req: NextRequest) {
  try {
    const { userId, token } = await req.json()
    if (!userId || !token) {
      return NextResponse.json({ error: 'userId and token required' }, { status: 400 })
    }

    await adminDb.collection('users').doc(userId).update({
      fcmTokens: FieldValue.arrayUnion(token),
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[FCM register]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
