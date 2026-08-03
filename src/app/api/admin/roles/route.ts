import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { ADMINS_COLLECTION, type AdminRecord, type AdminRole } from '@/lib/admin-auth'

export interface AdminRolesResponse {
  /** PAX user id → role, for every admin who has linked a PAX account. */
  roles: Record<string, AdminRole>
}

/**
 * GET /api/admin/roles — which PAX are admins, for the ADMIN tag beside their
 * name in the feed.
 *
 * Unauthenticated, like `/api/admin/status`, and for the same reason: PAX have
 * no credential to present. It's the bulk form of a question that endpoint
 * already answers one id at a time, which is what makes it usable from a feed
 * — a per-post lookup would be one request per author.
 *
 * It grants nothing and returns no email, uid or name — only PAX ids that are
 * already public in the roster, and a role. Every action still re-reads
 * `admins/{uid}` server-side against a Google ID token.
 *
 * **Live admins only.** A pending designation or invite is a name on a list,
 * not yet an admin, so it gets no tag — unlike `/api/admin/status`, which
 * reports pending so the person can find their way to /admin and sign in.
 * Revoking an admin removes the tag on the next load, everywhere, because
 * nothing about it is stored on the posts themselves.
 */
export async function GET() {
  try {
    const snap = await adminDb.collection(ADMINS_COLLECTION).get()

    const roles: Record<string, AdminRole> = {}
    for (const doc of snap.docs) {
      const record = doc.data() as AdminRecord
      // An admin who never linked a PAX account has no name in the app to tag.
      if (record.userId) roles[record.userId] = record.role
    }

    return NextResponse.json({ roles } satisfies AdminRolesResponse)
  } catch (err) {
    console.error('[admin roles]', err)
    // Fail closed: no tags rather than a broken feed.
    return NextResponse.json({ roles: {} } satisfies AdminRolesResponse)
  }
}
