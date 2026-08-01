import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase-admin'
import { requireAdmin, auditWrite, adminErrorResponse, AdminAuthError } from '@/lib/admin-auth'
import { resolveRegion } from '@/lib/challenges'
import type { User } from '@/types'

type Action = 'archive' | 'unarchive' | 'rename'

interface Body {
  action?: Action
  /** Only for `rename`. */
  displayName?: string
}

/**
 * PATCH /api/admin/users/[userId] — archive, unarchive or rename a PAX.
 *
 * The mutation and its audit entry go in one WriteBatch. Written separately,
 * a failure between them leaves either an unlogged admin action or a log of
 * something that never happened, and an audit trail you can't trust is worse
 * than none.
 *
 * Region move is deliberately absent. Moving a PAX with history leaves their
 * old posts, mentions and reactions unresolvable in the origin region, because
 * name lookup is scoped to one region's roster. See docs/MULTI_REGION.md.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const body = (await req.json().catch(() => ({}))) as Body

    const ref = adminDb.collection('users').doc(userId)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Unknown user' }, { status: 404 })
    }
    const user = { id: snap.id, ...(snap.data() as Omit<User, 'id'>) }

    // Region comes from the target document, never the request — this is the
    // check that actually scopes a region admin.
    const regionId = resolveRegion(user.regionId).id
    const principal = await requireAdmin(req, { regionId })

    const batch = adminDb.batch()
    const now = new Date().toISOString()
    let action: string
    let before: unknown
    let after: unknown

    switch (body.action) {
      case 'archive': {
        if (user.status === 'archived') {
          return NextResponse.json({ error: 'Already archived' }, { status: 409 })
        }
        before = { status: user.status ?? 'active' }
        after = { status: 'archived', archivedAt: now, archivedBy: principal.uid }
        batch.update(ref, { status: 'archived', archivedAt: now, archivedBy: principal.uid })
        action = 'user.archive'
        break
      }
      case 'unarchive': {
        if (user.status !== 'archived') {
          return NextResponse.json({ error: 'Not archived' }, { status: 409 })
        }
        before = { status: 'archived', archivedAt: user.archivedAt }
        after = { status: 'active' }
        // Cleared rather than set to 'active' so the field returns to absent,
        // which is what every read path already treats as active.
        batch.update(ref, {
          status: FieldValue.delete(),
          archivedAt: FieldValue.delete(),
          archivedBy: FieldValue.delete(),
        })
        action = 'user.unarchive'
        break
      }
      case 'rename': {
        const name = (body.displayName ?? '').trim()
        if (name.length < 2) {
          throw new AdminAuthError(422, 'Name must be at least 2 characters')
        }
        // Names are reserved region-wide including archived PAX: mentions
        // resolve by display name, so a duplicate makes old posts ambiguous.
        const clash = await adminDb.collection('users')
          .where('regionId', '==', regionId)
          .get()
        const taken = clash.docs.some(d =>
          d.id !== userId &&
          ((d.data() as User).displayName ?? '').toLowerCase() === name.toLowerCase()
        )
        if (taken) throw new AdminAuthError(409, `"${name}" is already taken in ${regionId}`)

        before = { displayName: user.displayName }
        after = { displayName: name }
        batch.update(ref, { displayName: name })
        action = 'user.rename'
        break
      }
      default:
        throw new AdminAuthError(422, 'Unknown action')
    }

    const audit = auditWrite({
      actor: principal,
      action,
      targetType: 'user',
      targetId: userId,
      regionId,
      before,
      after,
    })
    batch.set(audit.ref, audit.data)

    await batch.commit()
    return NextResponse.json({ ok: true })
  } catch (err) {
    const { status, body } = adminErrorResponse(err)
    return NextResponse.json(body, { status })
  }
}
