import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import {
  verifyCaller, tryBootstrap, adminErrorResponse,
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
    const { uid, email } = await verifyCaller(req)

    const snap = await adminDb.collection(ADMINS_COLLECTION).doc(uid).get()
    if (snap.exists) {
      return NextResponse.json({ uid, email, record: snap.data() as AdminRecord })
    }

    const bootstrapped = await tryBootstrap(uid, email)
    if (bootstrapped) {
      return NextResponse.json({ uid, email, record: bootstrapped })
    }

    return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
  } catch (err) {
    const { status, body } = adminErrorResponse(err)
    return NextResponse.json(body, { status })
  }
}
