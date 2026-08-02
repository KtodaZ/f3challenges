import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import {
  requireAnyAdmin, assertSuperadmin, adminErrorResponse,
  ADMINS_COLLECTION, type AdminRecord,
} from '@/lib/admin-auth'

export interface AdminRow extends AdminRecord {
  uid: string
  /** True for the caller's own record, so the UI can stop them revoking
   *  themselves and locking everyone out. */
  isSelf: boolean
}

/** GET — every admin. Superadmin only; a region admin has no business seeing
 *  who else holds access. */
export async function GET(req: NextRequest) {
  try {
    const principal = await requireAnyAdmin(req)
    assertSuperadmin(principal)

    const snap = await adminDb.collection(ADMINS_COLLECTION).get()
    const admins: AdminRow[] = snap.docs
      .map(d => ({ uid: d.id, ...(d.data() as AdminRecord), isSelf: d.id === principal.uid }))
      .sort((a, b) => {
        if (a.role !== b.role) return a.role === 'superadmin' ? -1 : 1
        return (a.paxName ?? a.email).localeCompare(b.paxName ?? b.email)
      })

    return NextResponse.json({ admins })
  } catch (err) {
    const { status, body } = adminErrorResponse(err)
    return NextResponse.json(body, { status })
  }
}
