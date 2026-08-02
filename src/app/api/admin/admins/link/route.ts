import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase-admin'
import {
  requireAnyAdmin, auditWrite, adminErrorResponse, AdminAuthError,
  ADMINS_COLLECTION,
} from '@/lib/admin-auth'
import type { User } from '@/types'

/**
 * POST /api/admin/admins/link — attach (or detach) your own PAX account.
 *
 * You can only ever link yourself: the target is the caller's own uid, never a
 * parameter. Linking someone else's admin record to a PAX account is not a
 * thing anyone needs, and making it impossible is cheaper than guarding it.
 *
 * Bootstrap can't do this automatically — it knows a Google account and
 * nothing about which F3 name that person posts under, and PAX records carry
 * no email to match on. So the first superadmin always starts unlinked.
 *
 * The link is what lets the app show admin controls to a signed-in PAX on any
 * device without them signing in first (see /api/admin/status), and what makes
 * the audit log read "Gelato archived Hot Keys" rather than an email address.
 */
export async function POST(req: NextRequest) {
  try {
    const principal = await requireAnyAdmin(req)
    const { userId } = (await req.json().catch(() => ({}))) as { userId?: string | null }

    const ref = adminDb.collection(ADMINS_COLLECTION).doc(principal.uid)

    if (!userId) {
      const audit = auditWrite({
        actor: principal,
        action: 'admin.unlink-pax',
        targetType: 'admin',
        targetId: principal.uid,
        before: { userId: principal.record.userId, paxName: principal.record.paxName },
      })
      const batch = adminDb.batch()
      batch.update(ref, { userId: FieldValue.delete(), paxName: FieldValue.delete() })
      batch.set(audit.ref, audit.data)
      await batch.commit()
      return NextResponse.json({ ok: true, userId: null })
    }

    const userSnap = await adminDb.collection('users').doc(userId).get()
    if (!userSnap.exists) throw new AdminAuthError(422, 'Unknown PAX')
    const user = userSnap.data() as User

    // One PAX account per admin, and one admin per PAX account — otherwise
    // /api/admin/status could match two records and answer arbitrarily.
    const taken = await adminDb.collection(ADMINS_COLLECTION)
      .where('userId', '==', userId)
      .get()
    if (taken.docs.some(d => d.id !== principal.uid)) {
      throw new AdminAuthError(409, `${user.displayName} is already linked to another admin`)
    }

    const audit = auditWrite({
      actor: principal,
      action: 'admin.link-pax',
      targetType: 'admin',
      targetId: principal.uid,
      before: { userId: principal.record.userId, paxName: principal.record.paxName },
      after: { userId, paxName: user.displayName },
    })
    const batch = adminDb.batch()
    batch.update(ref, { userId, paxName: user.displayName })
    batch.set(audit.ref, audit.data)
    await batch.commit()

    return NextResponse.json({ ok: true, userId, paxName: user.displayName })
  } catch (err) {
    const { status, body } = adminErrorResponse(err)
    return NextResponse.json(body, { status })
  }
}
