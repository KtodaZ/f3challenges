import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import {
  ADMINS_COLLECTION, DESIGNATIONS_COLLECTION, INVITES_COLLECTION,
  type AdminRecord, type AdminDesignation, type AdminInvite,
} from '@/lib/admin-auth'

export interface AdminStatusResponse {
  isAdmin: boolean
  role?: 'superadmin' | 'regionAdmin'
  regionIds: string[]
  /** Designated or invited but never signed in — the controls show, and the
   *  first one they touch sends them to /admin to sign in with Google. */
  pending?: boolean
}

/**
 * GET /api/admin/status?userId=<paxId> — "is this PAX an admin?"
 *
 * Unauthenticated, necessarily: PAX have no credential to present, and the
 * whole point is to answer before anyone signs in. It exists to break a
 * chicken-and-egg — the Admin link used to be gated on a local flag that only
 * appeared *after* visiting /admin, so a device that had never been there (a
 * phone, or anything whose storage was cleared) had no route in.
 *
 * It grants nothing. It reports whether a PAX id is linked to an admin record;
 * every action still requires a Google sign-in and re-reads `admins/{uid}`
 * server-side. Deliberately returns no email, uid or name — only what the UI
 * needs to decide which controls to render.
 *
 * It does let anyone who can guess a user id learn whether that PAX is an
 * admin. In an app whose entire roster is already public and whose database is
 * world-readable, that's not a meaningful disclosure — but it is a disclosure,
 * so it's stated rather than hidden.
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  const none: AdminStatusResponse = { isAdmin: false, regionIds: [] }

  if (!userId) return NextResponse.json(none)

  try {
    const snap = await adminDb.collection(ADMINS_COLLECTION)
      .where('userId', '==', userId)
      .limit(1)
      .get()

    if (!snap.empty) {
      const record = snap.docs[0].data() as AdminRecord
      return NextResponse.json({
        isAdmin: true,
        role: record.role,
        regionIds: record.regionIds ?? [],
      } satisfies AdminStatusResponse)
    }

    // Designated or invited, but not yet signed in. Showing the menu now is
    // the point: it's how someone finds out they've been made an admin. It
    // still grants nothing — every action needs a Google ID token, and the
    // first one they try routes them to /admin to get one.
    //
    // `resolveLinkablePax` guarantees at most one row across both collections
    // claims a given PAX, so these can't disagree.
    const [designated, invited] = await Promise.all([
      adminDb.collection(DESIGNATIONS_COLLECTION).where('userId', '==', userId).limit(1).get(),
      adminDb.collection(INVITES_COLLECTION).where('userId', '==', userId).limit(1).get(),
    ])

    const pending = !designated.empty
      ? (designated.docs[0].data() as AdminDesignation)
      : !invited.empty
        ? (invited.docs[0].data() as AdminInvite)
        : null

    if (!pending) return NextResponse.json(none)
    // An expired invite grants nothing on claim, so it must not show controls.
    if ('expiresAt' in pending && new Date(pending.expiresAt).getTime() < Date.now()) {
      return NextResponse.json(none)
    }

    return NextResponse.json({
      isAdmin: true,
      role: pending.role,
      regionIds: pending.regionIds ?? [],
      pending: true,
    } satisfies AdminStatusResponse)
  } catch (err) {
    console.error('[admin status]', err)
    // Fail closed: no controls rather than controls that can't work.
    return NextResponse.json(none)
  }
}
