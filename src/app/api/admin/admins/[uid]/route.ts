import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import {
  requireAnyAdmin, assertSuperadmin, auditWrite, adminErrorResponse, AdminAuthError,
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
    const principal = await requireAnyAdmin(req)
    assertSuperadmin(principal)

    // Revoking yourself is how you end up locked out of your own panel with
    // nobody able to let you back in.
    if (uid === principal.uid) {
      throw new AdminAuthError(409, "You can't revoke your own access")
    }

    const ref = adminDb.collection(ADMINS_COLLECTION).doc(uid)

    // In a transaction, because the guard below is a count. Two superadmins
    // revoking each other in overlapping requests would each read "there are
    // 2" outside one, both proceed, and empty the collection — and bootstrap is
    // permanently closed by its marker, so there is no way back in short of
    // editing Firestore by hand.
    await adminDb.runTransaction(async tx => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new AdminAuthError(404, 'Unknown admin')
      const record = snap.data() as AdminRecord

      if (record.role === 'superadmin') {
        const supers = await tx.get(
          adminDb.collection(ADMINS_COLLECTION).where('role', '==', 'superadmin')
        )
        if (supers.size <= 1) {
          throw new AdminAuthError(409, 'That is the only superadmin — promote someone else first')
        }
      }

      const audit = auditWrite({
        actor: principal,
        action: 'admin.revoke',
        targetType: 'admin',
        targetId: uid,
        before: record,
      })
      tx.delete(ref)
      tx.set(audit.ref, audit.data)
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const { status, body } = adminErrorResponse(err)
    return NextResponse.json(body, { status })
  }
}
