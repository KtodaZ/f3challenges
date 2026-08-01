import type { NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { isValidRegionId } from '@/lib/challenges'

/**
 * Admin authorization.
 *
 * Two things about this are deliberate and worth not "fixing" later:
 *
 * **No custom claims.** Roles live in `admins/{uid}` and are read on every
 * request. Claims would be one fewer read, but they are cached in the ID token
 * until it expires: a revoked admin keeps working for up to an hour, and
 * `verifyIdToken()` does not detect revocation unless explicitly asked to.
 * Claims also can't be written in the same transaction as Firestore, and
 * `setCustomUserClaims` replaces the whole claims object, so concurrent grants
 * clobber each other. Reading the doc removes all of that: revocation is a
 * delete, and it takes effect on the next request.
 *
 * **PAX are not authenticated.** Only admins sign in. This module protects the
 * admin endpoints; it does not and cannot make the database tamper-proof while
 * Firestore rules stay open to unauthenticated clients.
 */

export type AdminRole = 'superadmin' | 'regionAdmin'

export interface AdminRecord {
  email: string
  displayName?: string
  photoUrl?: string
  role: AdminRole
  /** Regions a `regionAdmin` may act on. Ignored for `superadmin`. */
  regionIds: string[]
  createdAt: string
  createdBy: string
}

export interface AdminPrincipal {
  uid: string
  email: string
  record: AdminRecord
}

export const ADMINS_COLLECTION   = 'admins'
export const AUDIT_COLLECTION    = 'adminAudit'
export const BOOTSTRAP_DOC       = 'adminBootstrap/marker'

/** Thrown by requireAdmin; carries the HTTP status the route should return. */
export class AdminAuthError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = 'AdminAuthError'
  }
}

/** Emails compare case-insensitively and without surrounding whitespace —
 *  an allowlist that silently never matches is a bad failure mode. */
function normalizeEmail(email: string | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

export function bootstrapEmails(): string[] {
  return (process.env.ADMIN_BOOTSTRAP_EMAILS ?? '')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean)
}

function bearerToken(req: NextRequest): string {
  const header = req.headers.get('authorization') ?? ''
  if (!header.startsWith('Bearer ')) {
    throw new AdminAuthError(401, 'Missing bearer token')
  }
  const token = header.slice('Bearer '.length).trim()
  if (!token) throw new AdminAuthError(401, 'Missing bearer token')
  return token
}

/** Verifies the caller's Google sign-in and returns their identity. Says
 *  nothing about whether they're an admin. */
export async function verifyCaller(req: NextRequest): Promise<{ uid: string; email: string }> {
  const token = bearerToken(req)
  let decoded
  try {
    decoded = await adminAuth.verifyIdToken(token)
  } catch {
    throw new AdminAuthError(401, 'Invalid or expired token')
  }
  // Google sign-in always verifies the address, but a future provider might
  // not — an unverified email must never satisfy an allowlist.
  if (!decoded.email || decoded.email_verified !== true) {
    throw new AdminAuthError(401, 'Unverified email')
  }
  return { uid: decoded.uid, email: normalizeEmail(decoded.email) }
}

export function canActOnRegion(record: AdminRecord, regionId: string | undefined): boolean {
  if (record.role === 'superadmin') return true
  if (!regionId) return false
  return record.regionIds.includes(regionId)
}

/**
 * The gate every admin route calls first.
 *
 * `regionId` must be resolved from Firestore by the caller — from the target
 * document, never from the request body. Taking it from the body would let a
 * region admin name any region they like and pass their own check.
 */
export async function requireAdmin(
  req: NextRequest,
  opts: { regionId?: string } = {}
): Promise<AdminPrincipal> {
  const { uid, email } = await verifyCaller(req)

  const snap = await adminDb.collection(ADMINS_COLLECTION).doc(uid).get()
  if (!snap.exists) {
    throw new AdminAuthError(403, 'Not an admin')
  }
  const record = snap.data() as AdminRecord

  if (!canActOnRegion(record, opts.regionId)) {
    throw new AdminAuthError(403, `Not an admin for region ${opts.regionId ?? '(unspecified)'}`)
  }

  return { uid, email, record }
}

/**
 * One-time creation of the first superadmin, from `ADMIN_BOOTSTRAP_EMAILS`.
 *
 * Guarded by a durable marker rather than "are there any admins yet", because
 * the latter reopens bootstrap the moment the last admin is revoked. All reads
 * happen before any write, as Firestore transactions require.
 *
 * Returns null when bootstrap is closed — callers should treat that as an
 * ordinary 403 and not leak which condition failed.
 */
export async function tryBootstrap(
  uid: string,
  email: string,
  profile: { displayName?: string; photoUrl?: string } = {}
): Promise<AdminRecord | null> {
  const allowed = bootstrapEmails()
  if (allowed.length === 0 || !allowed.includes(email)) return null

  const markerRef = adminDb.doc(BOOTSTRAP_DOC)
  const adminRef  = adminDb.collection(ADMINS_COLLECTION).doc(uid)
  const auditRef  = adminDb.collection(AUDIT_COLLECTION).doc()

  return adminDb.runTransaction(async tx => {
    // ── reads ──
    const marker    = await tx.get(markerRef)
    const existing  = await tx.get(
      adminDb.collection(ADMINS_COLLECTION).where('role', '==', 'superadmin').limit(1)
    )

    if (marker.exists) return null

    // A superadmin created by hand, before any marker existed. Seed the marker
    // so revoking them later doesn't silently reopen bootstrap to the allowlist.
    if (!existing.empty) {
      tx.set(markerRef, {
        bootstrappedAt: new Date().toISOString(),
        uid: existing.docs[0].id,
        note: 'seeded from a pre-existing superadmin',
      })
      return null
    }

    // ── writes ──
    const record: AdminRecord = {
      email,
      role: 'superadmin',
      regionIds: [],
      createdAt: new Date().toISOString(),
      createdBy: 'bootstrap',
      ...(profile.displayName ? { displayName: profile.displayName } : {}),
      ...(profile.photoUrl ? { photoUrl: profile.photoUrl } : {}),
    }
    tx.set(adminRef, record)
    tx.set(markerRef, { bootstrappedAt: record.createdAt, uid })
    tx.set(auditRef, {
      at: record.createdAt,
      actorUid: uid,
      actorEmail: email,
      action: 'admin.bootstrap',
      targetType: 'admin',
      targetId: uid,
      after: record,
    })
    return record
  })
}

export interface AuditEntry {
  actor: AdminPrincipal
  action: string
  targetType: 'user' | 'post' | 'comment' | 'admin'
  targetId: string
  regionId?: string
  before?: unknown
  after?: unknown
}

/**
 * Builds the audit write for a mutation. Returns the ref and payload so the
 * caller can put it in the SAME WriteBatch as the change it records — an audit
 * written separately can succeed while the mutation fails, or vice versa, and
 * a log you can't trust is worse than none.
 */
export function auditWrite(entry: AuditEntry) {
  const ref = adminDb.collection(AUDIT_COLLECTION).doc()
  const data = {
    at: new Date().toISOString(),
    actorUid: entry.actor.uid,
    actorEmail: entry.actor.email,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    ...(entry.regionId ? { regionId: entry.regionId } : {}),
    ...(entry.before !== undefined ? { before: entry.before } : {}),
    ...(entry.after !== undefined ? { after: entry.after } : {}),
  }
  return { ref, data }
}

/** Region ids on an admin record must be real — a typo would otherwise create
 *  an admin who silently governs nothing. */
export function validateRegionIds(regionIds: unknown): string[] {
  if (!Array.isArray(regionIds)) throw new AdminAuthError(422, 'regionIds must be an array')
  const ids = regionIds.map(String)
  const bad = ids.filter(id => !isValidRegionId(id))
  if (bad.length) throw new AdminAuthError(422, `Unknown region(s): ${bad.join(', ')}`)
  return ids
}

/** Convenience for route handlers: maps AdminAuthError to a Response shape. */
export function adminErrorResponse(err: unknown): { status: number; body: { error: string } } {
  if (err instanceof AdminAuthError) return { status: err.status, body: { error: err.message } }
  console.error('[admin]', err)
  return { status: 500, body: { error: 'Internal error' } }
}

export { FieldValue }
