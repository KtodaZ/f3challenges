import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminMessaging } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import type { User } from '@/types'

export async function POST(req: NextRequest) {
  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const userSnap = await adminDb.collection('users').doc(userId).get()
  if (!userSnap.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const user = userSnap.data() as User
  if (!user.fcmTokens?.length) {
    return NextResponse.json({ error: 'no_tokens' }, { status: 400 })
  }

  let anySuccess = false

  for (const token of user.fcmTokens) {
    try {
      await adminMessaging.send({
        token,
        notification: {
          title: 'Test — it works! 💪',
          body: 'Your F3 Bedrock notifications are set up correctly.',
        },
        data: { link: '/settings/notifications' },
        webpush: {
          notification: { icon: '/icons/icon-192.png', badge: '/icons/icon-192.png' },
          fcmOptions: { link: '/settings/notifications' },
        },
      })
      anySuccess = true
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      if (code === 'messaging/registration-token-not-registered') {
        await adminDb.collection('users').doc(userId).update({
          fcmTokens: FieldValue.arrayRemove(token),
        })
      }
    }
  }

  return NextResponse.json({ sent: anySuccess })
}
