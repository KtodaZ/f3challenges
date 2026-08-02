/**
 * Shared plumbing for the admin route tests.
 *
 * Routes are invoked as what they are — plain exported functions taking a
 * `NextRequest` — rather than over HTTP. There's no server to boot, and the
 * thing under test is the wiring between `requireAnyAdmin` / `assertRegion`
 * and the handler body, which is identical either way.
 */
import { NextRequest } from 'next/server'
import { vi } from 'vitest'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import {
  ADMINS_COLLECTION,
  AUDIT_COLLECTION,
  INVITES_COLLECTION,
  type AdminRecord,
  type AdminInvite,
} from '@/lib/admin-auth'

export const PROJECT_ID = 'f3-api-test'

/** The stubbed `verifyIdToken`. Typed loosely because the module is mocked. */
const verifyIdToken = (adminAuth as unknown as {
  verifyIdToken: ReturnType<typeof vi.fn>
}).verifyIdToken

// ── identities ───────────────────────────────────────────────────────────────

export const SUPER_UID  = 'uid-superadmin'
export const BEDROCK_UID = 'uid-bedrock-admin'
export const SACTOWN_UID = 'uid-sactown-admin'
export const STRANGER_UID = 'uid-signed-in-nobody'

/**
 * Points the stubbed token verifier at one identity.
 *
 * Every token string other than the sentinels below is treated as invalid, so
 * a test that forgets to call this gets a 401 rather than silently running as
 * whoever went last.
 */
export function asCaller(uid: string, over: Record<string, unknown> = {}) {
  verifyIdToken.mockImplementation(async (token: string) => {
    if (token !== `token-for-${uid}`) throw new Error('bad token')
    return {
      uid,
      email: `${uid}@example.com`,
      email_verified: true,
      name: uid,
      ...over,
    }
  })
  return `token-for-${uid}`
}

/** Makes every token invalid — for the 401 cases. */
export function noValidTokens() {
  verifyIdToken.mockImplementation(async () => {
    throw new Error('bad token')
  })
}

// ── requests ─────────────────────────────────────────────────────────────────

interface ReqOpts {
  token?: string
  body?: unknown
  search?: Record<string, string>
}

export function req(method: string, path: string, opts: ReqOpts = {}): NextRequest {
  const url = new URL(path, 'https://f3challenges.com')
  for (const [k, v] of Object.entries(opts.search ?? {})) url.searchParams.set(k, v)

  const headers = new Headers({ 'content-type': 'application/json' })
  if (opts.token) headers.set('authorization', `Bearer ${opts.token}`)

  return new NextRequest(url, {
    method,
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  })
}

/** Next 16 hands dynamic segments to a handler as a promise. */
export function ctx<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) }
}

export async function json<T = Record<string, unknown>>(res: Response): Promise<T> {
  return (await res.json()) as T
}

// ── database ─────────────────────────────────────────────────────────────────

/**
 * Wipes the emulator, subcollections included.
 *
 * The emulator's own REST endpoint rather than a recursive delete: it is one
 * call, it can't miss a collection a test invented, and it's what
 * `clearFirestore()` in the rules suite does under the hood.
 */
export async function clearDb(): Promise<void> {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8181'
  const res = await fetch(
    `http://${host}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' }
  )
  if (!res.ok) throw new Error(`Failed to clear emulator: ${res.status}`)
}

export function adminRecord(over: Partial<AdminRecord> = {}): AdminRecord {
  return {
    email: 'admin@example.com',
    role: 'regionAdmin',
    regionIds: ['bedrock'],
    createdAt: '2026-08-01T00:00:00.000Z',
    createdBy: 'seed',
    ...over,
  }
}

/** Writes an `admins/{uid}` document — what actually makes a caller an admin. */
export async function seedAdmin(uid: string, over: Partial<AdminRecord> = {}) {
  const record = adminRecord({ email: `${uid}@example.com`, ...over })
  await adminDb.collection(ADMINS_COLLECTION).doc(uid).set(record)
  return record
}

/** The cast that every test starts from: one superadmin, one admin per region. */
export async function seedAdmins() {
  await seedAdmin(SUPER_UID, { role: 'superadmin', regionIds: [] })
  await seedAdmin(BEDROCK_UID, { role: 'regionAdmin', regionIds: ['bedrock'] })
  await seedAdmin(SACTOWN_UID, { role: 'regionAdmin', regionIds: ['sactown'] })
}

/**
 * Drops undefined keys before a write.
 *
 * Only the seed helpers use this. The routes themselves are left to hit the
 * real "Unsupported field value: undefined" error if they ever regress —
 * `ignoreUndefinedProperties` on the client would hide exactly that.
 */
function defined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T
}

export interface SeedUser {
  id: string
  displayName: string
  regionId?: string
  status?: 'archived'
  formerNames?: string[]
  archivedAt?: string
  fcmTokens?: string[]
}

export async function seedUser(user: SeedUser) {
  const { id, ...rest } = user
  await adminDb.collection('users').doc(id).set(defined({
    createdAt: '2026-01-01T00:00:00.000Z',
    ...rest,
  }))
  return id
}

export interface SeedPost {
  id: string
  authorId: string
  regionId?: string
  content?: string
  deleted?: boolean
  createdAt?: string
}

export async function seedPost(post: SeedPost) {
  await adminDb.collection('feed').doc(post.id).set(defined({
    type: 'text',
    authorId: post.authorId,
    regionId: post.regionId,
    content: post.content ?? 'a post',
    hashtags: [],
    mentions: [],
    createdAt: post.createdAt ?? '2026-08-01T12:00:00.000Z',
    deleted: post.deleted ?? false,
  }))
  return post.id
}

export async function seedComment(
  postId: string,
  commentId: string,
  over: { authorId?: string; content?: string; deleted?: boolean } = {}
) {
  await adminDb.collection('feed').doc(postId).collection('comments').doc(commentId).set({
    postId,
    authorId: over.authorId ?? 'pax-1',
    content: over.content ?? 'a comment',
    createdAt: '2026-08-01T13:00:00.000Z',
    deleted: over.deleted ?? false,
  })
  return commentId
}

export async function seedInvite(token: string, over: Partial<AdminInvite> = {}) {
  const invite: AdminInvite = {
    role: 'regionAdmin',
    regionIds: ['bedrock'],
    createdAt: '2026-08-01T00:00:00.000Z',
    createdBy: SUPER_UID,
    createdByEmail: `${SUPER_UID}@example.com`,
    expiresAt: new Date(Date.now() + 86400_000).toISOString(),
    ...over,
  }
  await adminDb.collection(INVITES_COLLECTION).doc(token).set(invite)
  return invite
}

// ── reads back ───────────────────────────────────────────────────────────────

export async function getUser(id: string) {
  const snap = await adminDb.collection('users').doc(id).get()
  return snap.exists ? (snap.data() as Record<string, unknown>) : undefined
}

export async function getPost(id: string) {
  const snap = await adminDb.collection('feed').doc(id).get()
  return snap.exists ? (snap.data() as Record<string, unknown>) : undefined
}

export async function getAdminDoc(uid: string) {
  const snap = await adminDb.collection(ADMINS_COLLECTION).doc(uid).get()
  return snap.exists ? (snap.data() as AdminRecord) : undefined
}

export async function getInvite(token: string) {
  const snap = await adminDb.collection(INVITES_COLLECTION).doc(token).get()
  return snap.exists ? (snap.data() as AdminInvite) : undefined
}

export interface AuditRow {
  at: string
  actorUid: string
  actorEmail: string
  action: string
  targetType: string
  targetId: string
  regionId?: string
  before?: unknown
  after?: unknown
}

/** Every audit entry currently in the emulator, oldest first. */
export async function auditEntries(action?: string): Promise<AuditRow[]> {
  const snap = await adminDb.collection(AUDIT_COLLECTION).get()
  return snap.docs
    .map(d => d.data() as AuditRow)
    .filter(e => !action || e.action === action)
    .sort((a, b) => a.at.localeCompare(b.at))
}
