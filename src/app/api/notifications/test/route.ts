import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminMessaging } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import type { User } from '@/types'

const DBG = process.env.NEXT_PUBLIC_DEBUG_URL
function dbg(label: string, data: unknown) {
  if (!DBG) return
  fetch(DBG, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label, src: 'notifications/test', data }) }).catch(() => {})
}

export async function POST(req: NextRequest) {
  const { userId } = await req.json()
  dbg('request', { userId })
  dbg('env', {
    hasProjectId:   !!process.env.FIREBASE_PROJECT_ID,
    hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
    hasPrivateKey:  !!process.env.FIREBASE_PRIVATE_KEY,
    projectId:      process.env.FIREBASE_PROJECT_ID,
  })

  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const userSnap = await adminDb.collection('users').doc(userId).get()
  if (!userSnap.exists) {
    dbg('error', { reason: 'user not found', userId })
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const user = userSnap.data() as User
  dbg('user', { displayName: user.displayName, tokenCount: user.fcmTokens?.length ?? 0, tokens: user.fcmTokens?.map(t => t.slice(0, 20)) })

  if (!user.fcmTokens?.length) {
    dbg('error', { reason: 'no_tokens' })
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
      dbg('token-result', { token: token.slice(0, 20), success: true })
      anySuccess = true
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      const message = (err as { message?: string })?.message
      dbg('token-result', { token: token.slice(0, 20), success: false, code, message })
      if (code === 'messaging/registration-token-not-registered') {
        await adminDb.collection('users').doc(userId).update({
          fcmTokens: FieldValue.arrayRemove(token),
        })
        dbg('token-removed', { token: token.slice(0, 20) })
      }
    }
  }

  dbg('response', { sent: anySuccess })
  return NextResponse.json({ sent: anySuccess })
}
