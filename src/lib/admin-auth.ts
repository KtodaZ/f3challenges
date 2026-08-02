import type { NextRequest } from 'next/server'
import { createHash } from 'node:crypto'
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
  /**
   * The PAX account this admin is, when they're also in the app. Chosen when
   * the invite is created — PAX records carry no email, so the two identities
   * can never be matched automatically.
   *
   * Bookkeeping only: it grants nothing. It makes the audit log read "Babe
   * archived Hot Keys" instead of an email address, and lets the panel stop an
   * admin archiving their own PAX account by accident.
   */
  userId?: string
  /** F3 name of the linked PAX, denormalized so the audit log doesn't need a
   *  join to render a name. */
  paxName?: string
  createdAt: string
  createdBy: string
}

export interface AdminInvite {
  role: AdminRole
  regionIds: string[]
  userId?: string
  paxName?: string
  createdAt: string
  createdBy: string
  createdByEmail: string
  expiresAt: string
  /** Redeeming an invite deletes it, so these are only ever seen on documents
   *  written before that changed. Kept so old rows still parse. */
  claimedAt?: string
  claimedBy?: string
}

export interface AdminPrincipal {
  uid: string
  email: string
  record: AdminRecord
}

export const ADMINS_COLLECTION   = 'admins'
export const AUDIT_COLLECTION    = 'adminAudit'
export const INVITES_COLLECTION  = 'adminInvites'
export const BOOTSTRAP_DOC       = 'adminBootstrap/marker'

/** How long an unclaimed invite stays valid. Short enough that a forwarded or
 *  screenshotted link goes stale on its own. */
export const INVITE_TTL_DAYS = 7

/** Requires the caller to be a superadmin regardless of region — used by the
 *  endpoints that manage admins themselves. */
export function assertSuperadmin(principal: AdminPrincipal): void {
  if (principal.record.role !== 'superadmin') {
    throw new AdminAuthError(403, 'Superadmin only')
  }
}

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
export async function verifyCaller(
  req: NextRequest
): Promise<{ uid: string; email: string; displayName?: string; photoUrl?: string }> {
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
  return {
    uid: decoded.uid,
    email: normalizeEmail(decoded.email),
    displayName: decoded.name,
    photoUrl: decoded.picture,
  }
}

export function canActOnRegion(record: AdminRecord, regionId: string | undefined): boolean {
  if (record.role === 'superadmin') return true
  if (!regionId) return false
  return record.regionIds.includes(regionId)
}

/**
 * Authenticates the caller and confirms they hold admin access somewhere.
 * Says nothing about *which* region.
 *
 * This is what list endpoints use — they return data across everything the
 * caller governs, so there is no single region to check up front; they filter
 * by `record.regionIds` themselves. Mutations must use `requireAdmin` (or call
 * `assertRegion` once they know the target's region) instead.
 */
export async function requireAnyAdmin(req: NextRequest): Promise<AdminPrincipal> {
  const { uid, email } = await verifyCaller(req)

  const snap = await adminDb.collection(ADMINS_COLLECTION).doc(uid).get()
  if (!snap.exists) {
    throw new AdminAuthError(403, 'Not an admin')
  }

  return { uid, email, record: snap.data() as AdminRecord }
}

/**
 * Narrows an already-authenticated admin to one region.
 *
 * Split out from `requireAnyAdmin` so a mutation can authenticate *before*
 * reading its target — the target's region isn't known until it's been read,
 * and an unauthenticated caller shouldn't be able to make the server do work
 * or learn whether a document exists.
 */
export function assertRegion(principal: AdminPrincipal, regionId: string): void {
  if (!canActOnRegion(principal.record, regionId)) {
    throw new AdminAuthError(403, `Not an admin for region ${regionId}`)
  }
}

/**
 * The gate for anything scoped to a single region.
 *
 * `regionId` is REQUIRED, deliberately. It was previously optional, and
 * omitting it made `canActOnRegion` fail closed — which meant every list
 * endpoint that called `requireAdmin(req)` intending to filter afterwards
 * returned 403 to every region admin. Making it required moves that mistake
 * from a runtime lockout to a compile error; use `requireAnyAdmin` when there
 * genuinely is no single region in play.
 *
 * The value must be resolved from Firestore by the caller — from the target
 * document, never from the request body. Taking it from the body would let a
 * region admin name any region they like and pass their own check.
 */
export async function requireAdmin(
  req: NextRequest,
  opts: { regionId: string }
): Promise<AdminPrincipal> {
  const principal = await requireAnyAdmin(req)
  assertRegion(principal, opts.regionId)
  return principal
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

/**
 * A stable, non-secret handle for an invite, for use in the audit log.
 *
 * The invite token IS the credential — it's the document id and the whole
 * contents of the link. Writing it into an audit entry would mean any future
 * log export, support dump or admin-readable audit view hands out working
 * invite links. The hash still lets two audit entries about the same invite be
 * correlated.
 */
export function inviteRef(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 16)
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
