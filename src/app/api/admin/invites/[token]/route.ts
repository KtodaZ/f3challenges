import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import {
  requireAdmin, assertSuperadmin, auditWrite, adminErrorResponse,
  INVITES_COLLECTION, type AdminInvite,
} from '@/lib/admin-auth'

/** DELETE — revoke an unclaimed invite so the link stops working. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const principal = await requireAdmin(req)
    assertSuperadmin(principal)

    const ref = adminDb.collection(INVITES_COLLECTION).doc(token)
    const snap = await ref.get()
    if (!snap.exists) return NextResponse.json({ error: 'Unknown invite' }, { status: 404 })
    const invite = snap.data() as AdminInvite

    const batch = adminDb.batch()
    batch.delete(ref)
    const audit = auditWrite({
      actor: principal,
      action: 'admin.invite.revoke',
      targetType: 'admin',
      targetId: token,
      before: { role: invite.role, regionIds: invite.regionIds, paxName: invite.paxName },
    })
    batch.set(audit.ref, audit.data)
    await batch.commit()

    return NextResponse.json({ ok: true })
  } catch (err) {
    const { status, body } = adminErrorResponse(err)
    return NextResponse.json(body, { status })
  }
}
