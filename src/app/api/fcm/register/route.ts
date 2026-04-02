import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

export async function POST(req: NextRequest) {
  try {
    const { userId, token } = await req.json()
    if (!userId || !token) {
      return NextResponse.json({ error: 'userId and token required' }, { status: 400 })
    }

    await adminDb.collection('users').doc(userId).update({ fcmToken: token })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[FCM register]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
