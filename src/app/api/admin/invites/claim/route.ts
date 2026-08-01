import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import {
  verifyCaller, adminErrorResponse,
  ADMINS_COLLECTION, INVITES_COLLECTION, AUDIT_COLLECTION,
  type AdminInvite, type AdminRecord,
} from '@/lib/admin-auth'

/**
 * POST /api/admin/invites/claim — redeem an invite link.
 *
 * The caller only needs to be signed in with Google; they are by definition
 * not an admin yet, so this is the one admin endpoint that doesn't go through
 * requireAdmin.
 *
 * The whole thing runs in a transaction, reads before writes: two people
 * opening a forwarded link at the same time must not both become admins, and
 * a claimed invite must be dead the instant it's used.
 */
export async function POST(req: NextRequest) {
  try {
    const { uid, email } = await verifyCaller(req)
    const { token } = (await req.json().catch(() => ({}))) as { token?: string }
    if (!token) return NextResponse.json({ error: 'Missing invite' }, { status: 400 })

    const inviteRef = adminDb.collection(INVITES_COLLECTION).doc(token)
    const adminRef  = adminDb.collection(ADMINS_COLLECTION).doc(uid)
    const auditRef  = adminDb.collection(AUDIT_COLLECTION).doc()

    const result = await adminDb.runTransaction(async tx => {
      // ── reads ──
      const inviteSnap = await tx.get(inviteRef)
      const existing   = await tx.get(adminRef)

      if (!inviteSnap.exists) return { error: 'This invite link is not valid.' }
      const invite = inviteSnap.data() as AdminInvite

      if (invite.claimedAt) return { error: 'This invite has already been used.' }
      if (new Date(invite.expiresAt).getTime() < Date.now()) {
        return { error: 'This invite has expired. Ask for a new one.' }
      }
      if (existing.exists) {
        // Already an admin — consume the invite rather than leaving it live,
        // but don't overwrite whatever access they already have.
        tx.update(inviteRef, { claimedAt: new Date().toISOString(), claimedBy: uid })
        return { record: existing.data() as AdminRecord, alreadyAdmin: true }
      }

      // ── writes ──
      const now = new Date().toISOString()
      const record: AdminRecord = {
        email,
        role: invite.role,
        regionIds: invite.regionIds,
        createdAt: now,
        createdBy: invite.createdBy,
        ...(invite.userId ? { userId: invite.userId } : {}),
        ...(invite.paxName ? { paxName: invite.paxName } : {}),
      }
      tx.set(adminRef, record)
      tx.update(inviteRef, { claimedAt: now, claimedBy: uid })
      tx.set(auditRef, {
        at: now,
        actorUid: uid,
        actorEmail: email,
        action: 'admin.invite.claim',
        targetType: 'admin',
        targetId: uid,
        after: record,
      })
      return { record }
    })

    if ('error' in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: 403 })
    }
    return NextResponse.json(result)
  } catch (err) {
    const { status, body } = adminErrorResponse(err)
    return NextResponse.json(body, { status })
  }
}
