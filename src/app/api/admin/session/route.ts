import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import {
  verifyCaller, tryBootstrap, tryClaimDesignation, adminErrorResponse,
  ADMINS_COLLECTION, type AdminRecord,
} from '@/lib/admin-auth'

/**
 * POST /api/admin/session — "who am I, and am I allowed in?"
 *
 * Also the only place bootstrap can happen: the first sign-in from an address
 * in ADMIN_BOOTSTRAP_EMAILS becomes superadmin, once, guarded by a durable
 * marker. Everyone else has to be granted from inside the panel.
 *
 * Deliberately does not distinguish "not an admin" from "bootstrap is closed"
 * in the response — both are 403 with the same message. Telling an unknown
 * caller which allowlist they missed is free reconnaissance.
 */
export async function POST(req: NextRequest) {
  try {
    const { uid, email, displayName, photoUrl } = await verifyCaller(req)

    const snap = await adminDb.collection(ADMINS_COLLECTION).doc(uid).get()
    if (snap.exists) {
      return NextResponse.json({ uid, email, record: snap.data() as AdminRecord })
    }

    const bootstrapped = await tryBootstrap(uid, email, { displayName, photoUrl })
    if (bootstrapped) {
      return NextResponse.json({ uid, email, record: bootstrapped })
    }

    // Designated by a superadmin and signing in for the first time. This is
    // the whole of "accepting" — there is no link to open and no step to
    // explain, because a Google-verified address is proof enough of who this
    // is. See `AdminDesignation`.
    const claimed = await tryClaimDesignation(uid, email, { displayName, photoUrl })
    if (claimed) {
      return NextResponse.json({ uid, email, record: claimed })
    }

    return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
  } catch (err) {
    const { status, body } = adminErrorResponse(err)
    return NextResponse.json(body, { status })
  }
}
