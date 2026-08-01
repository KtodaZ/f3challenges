import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import {
  requireAdmin, assertSuperadmin, auditWrite, adminErrorResponse, AdminAuthError,
  ADMINS_COLLECTION, type AdminRecord,
} from '@/lib/admin-auth'

/**
 * DELETE /api/admin/admins/[uid] — revoke admin access.
 *
 * Effective immediately, with no token to wait out: authorization reads
 * admins/{uid} on every request, so deleting the document ends access on the
 * revoked admin's very next call. That is the whole reason roles aren't stored
 * in Firebase custom claims, which would stay valid in an already-issued token
 * until it expired.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params
    const principal = await requireAdmin(req)
    assertSuperadmin(principal)

    // Revoking yourself is how you end up locked out of your own panel with
    // nobody able to let you back in.
    if (uid === principal.uid) {
      throw new AdminAuthError(409, "You can't revoke your own access")
    }

    const ref = adminDb.collection(ADMINS_COLLECTION).doc(uid)
    const snap = await ref.get()
    if (!snap.exists) return NextResponse.json({ error: 'Unknown admin' }, { status: 404 })
    const record = snap.data() as AdminRecord

    // The last superadmin leaving means no one can ever grant access again —
    // bootstrap is one-time and stays closed once used.
    if (record.role === 'superadmin') {
      const supers = await adminDb.collection(ADMINS_COLLECTION)
        .where('role', '==', 'superadmin')
        .get()
      if (supers.size <= 1) {
        throw new AdminAuthError(409, 'That is the only superadmin — promote someone else first')
      }
    }

    const batch = adminDb.batch()
    batch.delete(ref)
    const audit = auditWrite({
      actor: principal,
      action: 'admin.revoke',
      targetType: 'admin',
      targetId: uid,
      before: record,
    })
    batch.set(audit.ref, audit.data)
    await batch.commit()

    return NextResponse.json({ ok: true })
  } catch (err) {
    const { status, body } = adminErrorResponse(err)
    return NextResponse.json(body, { status })
  }
}
