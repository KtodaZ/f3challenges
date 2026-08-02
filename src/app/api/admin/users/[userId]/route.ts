import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase-admin'
import { requireAnyAdmin, assertRegion, auditWrite, adminErrorResponse, AdminAuthError } from '@/lib/admin-auth'
import { isNameTaken } from '@/lib/roster'
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

    // Authenticate before touching Firestore: an unauthenticated caller
    // shouldn't be able to make the server do work, or learn from a 404
    // whether a given user id exists.
    const principal = await requireAnyAdmin(req)

    const ref = adminDb.collection('users').doc(userId)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Unknown user' }, { status: 404 })
    }
    const user = { id: snap.id, ...(snap.data() as Omit<User, 'id'>) }

    // Region comes from the target document, never the request — this is the
    // check that actually scopes a region admin.
    const regionId = resolveRegion(user.regionId).id
    assertRegion(principal, regionId)

    // Rename runs in a transaction rather than a batch, because its
    // precondition is a QUERY: "no other PAX in this region holds this name".
    // Checking that outside a transaction lets two admins rename two different
    // PAX to the same name at the same time — both queries see no clash, both
    // writes succeed, and mentions for that name become ambiguous forever.
    // tx.get(query) puts the query in the transaction's conflict set, so the
    // second one retries and then fails the check properly.
    if (body.action === 'rename') {
      const name = (body.displayName ?? '').trim()
      if (name.length < 2) throw new AdminAuthError(422, 'Name must be at least 2 characters')

      await adminDb.runTransaction(async tx => {
        // Read every user, not `where('regionId','==',regionId)`: a doc written
        // before regions existed has no regionId field and is invisible to an
        // equality filter, but resolveRegion() counts it as Bedrock — so the
        // query would miss exactly the legacy PAX whose name is most likely to
        // appear in old posts.
        const allUsers = await tx.get(adminDb.collection('users'))
        const targetSnap = await tx.get(ref)
        if (!targetSnap.exists) throw new AdminAuthError(404, 'Unknown user')

        const target = targetSnap.data() as User
        const sameRegion = allUsers.docs
          .map(d => ({ id: d.id, ...(d.data() as Omit<User, 'id'>) }))
          .filter(u => resolveRegion(u.regionId).id === regionId)

        if (isNameTaken(sameRegion, name, userId)) {
          throw new AdminAuthError(409, `"${name}" is already taken in ${regionId}`)
        }

        // The old name stays reserved. Mentions render by matching text against
        // displayName, so releasing it would let a future PAX claim it and
        // silently inherit every historical @mention of this person.
        const formerNames = Array.from(new Set([
          ...(target.formerNames ?? []),
          (target.displayName ?? '').toLowerCase(),
        ].filter(Boolean)))

        const audit = auditWrite({
          actor: principal,
          action: 'user.rename',
          targetType: 'user',
          targetId: userId,
          regionId,
          before: { displayName: target.displayName },
          after: { displayName: name, formerNames },
        })
        tx.update(ref, { displayName: name, formerNames })
        tx.set(audit.ref, audit.data)
      })

      return NextResponse.json({ ok: true })
    }

    const batch = adminDb.batch()
    const now = new Date().toISOString()
    let action: string
    let before: unknown
    let after: unknown

    switch (body.action) {
      case 'archive': {
        // Never the admin's own PAX account. Archiving yourself drops you out
        // of the crew you're administering, and the UI's disabled button is
        // only a hint — this is the part that actually holds.
        if (principal.record.userId && principal.record.userId === userId) {
          throw new AdminAuthError(409, "You can't archive your own PAX account")
        }
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
