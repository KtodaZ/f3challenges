import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { adminDb } from '@/lib/firebase-admin'
import {
  requireAnyAdmin, assertSuperadmin, auditWrite, adminErrorResponse,
  validateRegionIds, resolveLinkablePax, AdminAuthError,
  inviteRef, INVITES_COLLECTION, INVITE_TTL_DAYS,
  type AdminInvite, type AdminRole,
} from '@/lib/admin-auth'

export interface AdminInviteRow extends AdminInvite {
  token: string
  expired: boolean
}

/** GET — pending invites, newest first. Superadmin only. */
export async function GET(req: NextRequest) {
  try {
    assertSuperadmin(await requireAnyAdmin(req))

    const snap = await adminDb.collection(INVITES_COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get()

    // Claimed invites are deleted on redemption, so everything here is
    // genuinely outstanding — nothing is filtered out after the limit, which
    // would otherwise let dead rows hide live ones.
    const now = Date.now()
    const invites: AdminInviteRow[] = snap.docs
      .map(d => ({ token: d.id, ...(d.data() as AdminInvite) }))
      .map(i => ({ ...i, expired: new Date(i.expiresAt).getTime() < now }))

    return NextResponse.json({ invites })
  } catch (err) {
    const { status, body } = adminErrorResponse(err)
    return NextResponse.json(body, { status })
  }
}

/**
 * POST — create a single-use invite link. Superadmin only.
 *
 * The link carries a random token and nothing else; role, regions and the
 * optional PAX link are stored server-side against it, so the recipient can't
 * influence what they're granted. Whichever Google account claims it becomes
 * the admin — which is the point: nobody types an email address, so nothing
 * can be mistyped into a dead end.
 *
 * The alternative, when you do know the address they sign in with, is
 * POST /api/admin/designations — no link to send, and nothing that can be
 * forwarded to the wrong person. This route exists for when you don't.
 */
export async function POST(req: NextRequest) {
  try {
    const principal = await requireAnyAdmin(req)
    assertSuperadmin(principal)

    const body = await req.json().catch(() => ({})) as {
      role?: AdminRole
      regionIds?: unknown
      userId?: string
    }

    const role: AdminRole = body.role === 'superadmin' ? 'superadmin' : 'regionAdmin'
    const regionIds = role === 'superadmin' ? [] : validateRegionIds(body.regionIds ?? [])
    if (role === 'regionAdmin' && regionIds.length === 0) {
      throw new AdminAuthError(422, 'Pick at least one region')
    }

    // Resolve the linked PAX now so the audit log can show an F3 name without
    // a join, and so a bad id fails here rather than at claim time.
    const paxName = body.userId ? await resolveLinkablePax(body.userId) : undefined

    const token = randomBytes(24).toString('base64url')
    const now = new Date()
    const invite: AdminInvite = {
      role,
      regionIds,
      createdAt: now.toISOString(),
      createdBy: principal.uid,
      createdByEmail: principal.email,
      expiresAt: new Date(now.getTime() + INVITE_TTL_DAYS * 86400_000).toISOString(),
      ...(body.userId ? { userId: body.userId } : {}),
      ...(paxName ? { paxName } : {}),
    }

    const batch = adminDb.batch()
    batch.set(adminDb.collection(INVITES_COLLECTION).doc(token), invite)
    const audit = auditWrite({
      actor: principal,
      action: 'admin.invite',
      targetType: 'admin',
      targetId: inviteRef(token),
      after: { role, regionIds, paxName },
    })
    batch.set(audit.ref, audit.data)
    await batch.commit()

    return NextResponse.json({ token, invite })
  } catch (err) {
    const { status, body } = adminErrorResponse(err)
    return NextResponse.json(body, { status })
  }
}
