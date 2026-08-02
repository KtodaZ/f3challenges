import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import {
  requireAnyAdmin, assertSuperadmin, auditWrite, adminErrorResponse,
  DESIGNATIONS_COLLECTION, type AdminDesignation,
} from '@/lib/admin-auth'

/** DELETE — withdraw a designation before the person has signed in. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const principal = await requireAnyAdmin(req)
    assertSuperadmin(principal)

    // Ids are hex digests we mint; anything else is an invalid document path
    // and would throw inside Firestore as a confusing 500.
    if (!/^[a-f0-9]{32}$/.test(id)) {
      return NextResponse.json({ error: 'Unknown designation' }, { status: 404 })
    }

    const ref = adminDb.collection(DESIGNATIONS_COLLECTION).doc(id)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Unknown designation' }, { status: 404 })
    }
    const designation = snap.data() as AdminDesignation

    const batch = adminDb.batch()
    batch.delete(ref)
    const audit = auditWrite({
      actor: principal,
      action: 'admin.designate.withdraw',
      targetType: 'admin',
      targetId: id,
      before: {
        email: designation.email,
        role: designation.role,
        regionIds: designation.regionIds,
        paxName: designation.paxName,
      },
    })
    batch.set(audit.ref, audit.data)
    await batch.commit()

    return NextResponse.json({ ok: true })
  } catch (err) {
    const { status, body } = adminErrorResponse(err)
    return NextResponse.json(body, { status })
  }
}
