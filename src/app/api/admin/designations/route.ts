import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import {
  requireAnyAdmin, assertSuperadmin, auditWrite, adminErrorResponse,
  validateRegionIds, designationId, AdminAuthError,
  DESIGNATIONS_COLLECTION, ADMINS_COLLECTION,
  type AdminDesignation, type AdminRole,
} from '@/lib/admin-auth'
import type { User } from '@/types'

export interface AdminDesignationRow extends AdminDesignation {
  id: string
}

/** GET — people designated but not yet signed in, newest first. Superadmin only. */
export async function GET(req: NextRequest) {
  try {
    assertSuperadmin(await requireAnyAdmin(req))

    const snap = await adminDb.collection(DESIGNATIONS_COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get()

    // Claiming deletes the row, so everything here is genuinely outstanding.
    const designations: AdminDesignationRow[] = snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as AdminDesignation),
    }))

    return NextResponse.json({ designations })
  } catch (err) {
    const { status, body } = adminErrorResponse(err)
    return NextResponse.json(body, { status })
  }
}

/**
 * POST — designate an admin by email address. Superadmin only.
 *
 * They become an admin the first time they sign in at /admin with that Google
 * account; there is nothing to send them. See `AdminDesignation` for why the
 * email, rather than the PAX account, is what the grant is bound to.
 *
 * Linking a PAX here is optional and grants nothing on its own — but it is
 * what makes the Admin menu appear in their app right away, before they've
 * ever signed in, which is usually how they find out.
 */
export async function POST(req: NextRequest) {
  try {
    const principal = await requireAnyAdmin(req)
    assertSuperadmin(principal)

    const body = await req.json().catch(() => ({})) as {
      email?: string
      role?: AdminRole
      regionIds?: unknown
      userId?: string
    }

    const email = (body.email ?? '').trim().toLowerCase()
    // Deliberately loose: the address either matches a Google account at
    // sign-in or it doesn't, so the only mistake worth catching here is an
    // obviously malformed entry, not an unusual-but-real address.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AdminAuthError(422, 'Enter a valid email address')
    }

    const role: AdminRole = body.role === 'superadmin' ? 'superadmin' : 'regionAdmin'
    const regionIds = role === 'superadmin' ? [] : validateRegionIds(body.regionIds ?? [])
    if (role === 'regionAdmin' && regionIds.length === 0) {
      throw new AdminAuthError(422, 'Pick at least one region')
    }

    // Designating someone who already signed in would create a pending row
    // that can never do anything useful — their access is already live, and
    // the row would sit in the listing looking like an outstanding task.
    const already = await adminDb.collection(ADMINS_COLLECTION)
      .where('email', '==', email)
      .limit(1)
      .get()
    if (!already.empty) {
      throw new AdminAuthError(409, `${email} is already an admin`)
    }

    // Resolve the linked PAX now so a bad id fails here rather than at
    // sign-in, and so the audit log can show an F3 name without a join.
    let paxName: string | undefined
    if (body.userId) {
      const userSnap = await adminDb.collection('users').doc(body.userId).get()
      if (!userSnap.exists) throw new AdminAuthError(422, 'Unknown PAX')
      paxName = (userSnap.data() as User).displayName

      // One PAX per admin, pending or live: /api/admin/status matches on
      // userId across both collections, and two rows claiming the same PAX
      // would let it answer arbitrarily.
      const [takenLive, takenPending] = await Promise.all([
        adminDb.collection(ADMINS_COLLECTION).where('userId', '==', body.userId).limit(1).get(),
        adminDb.collection(DESIGNATIONS_COLLECTION).where('userId', '==', body.userId).limit(2).get(),
      ])
      const pendingElsewhere = takenPending.docs.some(d => d.id !== designationId(email))
      if (!takenLive.empty || pendingElsewhere) {
        throw new AdminAuthError(409, `${paxName} is already linked to an admin`)
      }
    }

    const designation: AdminDesignation = {
      email,
      role,
      regionIds,
      createdAt: new Date().toISOString(),
      createdBy: principal.uid,
      createdByEmail: principal.email,
      ...(body.userId ? { userId: body.userId } : {}),
      ...(paxName ? { paxName } : {}),
    }

    const id = designationId(email)
    const batch = adminDb.batch()
    // set(), not create(): re-designating the same address corrects the
    // pending row rather than failing or duplicating it.
    batch.set(adminDb.collection(DESIGNATIONS_COLLECTION).doc(id), designation)
    const audit = auditWrite({
      actor: principal,
      action: 'admin.designate',
      targetType: 'admin',
      targetId: id,
      after: { email, role, regionIds, paxName },
    })
    batch.set(audit.ref, audit.data)
    await batch.commit()

    return NextResponse.json({ id, designation })
  } catch (err) {
    const { status, body } = adminErrorResponse(err)
    return NextResponse.json(body, { status })
  }
}
