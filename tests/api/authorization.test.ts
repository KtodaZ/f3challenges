/**
 * The authorization boundary, endpoint by endpoint.
 *
 * This file exists because of one specific incident: `requireAdmin`'s
 * `regionId` was optional, the list endpoints called `requireAdmin(req)`
 * meaning "any region, I'll filter myself", and `canActOnRegion` fails closed
 * on a missing region — so every region admin got a 403 from every list
 * endpoint and the panel was useless to the only role it was built for.
 * Typecheck, lint, the unit suite and the build were all green.
 *
 * The unit tests for `canActOnRegion` were green too, which is the point: they
 * tested the helper, not the wiring. So the first thing asserted below is not a
 * status code but a NON-EMPTY body for a region admin — the exact thing the
 * bug destroyed and the exact thing a status-only assertion would miss.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { GET as listUsers } from '@/app/api/admin/users/route'
import { PATCH as patchUser } from '@/app/api/admin/users/[userId]/route'
import { GET as listFeed } from '@/app/api/admin/feed/route'
import { DELETE as deletePost } from '@/app/api/admin/feed/[postId]/route'
import { GET as listAdmins } from '@/app/api/admin/admins/route'
import { GET as listInvites, POST as createInvite } from '@/app/api/admin/invites/route'
import {
  asCaller, clearDb, ctx, getPost, getUser, json, noValidTokens, req,
  seedAdmin, seedAdmins, seedPost, seedUser,
  BEDROCK_UID, SACTOWN_UID, STRANGER_UID, SUPER_UID,
} from './harness'

interface UserRow { id: string; displayName: string; regionId: string }
interface PostRow { id: string; regionId: string }

beforeEach(async () => {
  await clearDb()
  await seedAdmins()
  await seedUser({ id: 'pax-bedrock', displayName: 'Splice', regionId: 'bedrock' })
  await seedUser({ id: 'pax-sactown', displayName: 'Hot Keys', regionId: 'sactown' })
  await seedPost({ id: 'post-bedrock', authorId: 'pax-bedrock', regionId: 'bedrock' })
  await seedPost({ id: 'post-sactown', authorId: 'pax-sactown', regionId: 'sactown' })
})

// ── 1 + 2: the regression, and scoping ───────────────────────────────────────

describe('GET /api/admin/users', () => {
  it('returns a NON-EMPTY list to a region admin for their own region', async () => {
    // The regression test. Under the optional-regionId bug this was a 403 with
    // no users at all.
    const res = await listUsers(req('GET', '/api/admin/users', { token: asCaller(BEDROCK_UID) }))
    expect(res.status).toBe(200)

    const { users } = await json<{ users: UserRow[] }>(res)
    expect(users.length).toBeGreaterThan(0)
    expect(users.map(u => u.id)).toContain('pax-bedrock')
  })

  it('shows a region admin only their own region', async () => {
    const res = await listUsers(req('GET', '/api/admin/users', { token: asCaller(SACTOWN_UID) }))
    const { users } = await json<{ users: UserRow[] }>(res)

    expect(users.map(u => u.id)).toEqual(['pax-sactown'])
    expect(users.every(u => u.regionId === 'sactown')).toBe(true)
  })

  it('shows a superadmin every region', async () => {
    const res = await listUsers(req('GET', '/api/admin/users', { token: asCaller(SUPER_UID) }))
    const { users } = await json<{ users: UserRow[] }>(res)

    expect(users.map(u => u.id).sort()).toEqual(['pax-bedrock', 'pax-sactown'])
  })

  it('carries per-PAX activity stats', async () => {
    // Guards the dailyLogs roll-up, which is the only non-trivial logic here.
    const { adminDb } = await import('@/lib/firebase-admin')
    await adminDb.collection('dailyLogs').doc('l1')
      .set({ userId: 'pax-bedrock', date: '2026-08-01' })
    await adminDb.collection('dailyLogs').doc('l2')
      .set({ userId: 'pax-bedrock', date: '2026-08-03' })

    const res = await listUsers(req('GET', '/api/admin/users', { token: asCaller(BEDROCK_UID) }))
    const { users } = await json<{ users: (UserRow & { logCount: number; lastActiveDate?: string })[] }>(res)

    expect(users[0].logCount).toBe(2)
    expect(users[0].lastActiveDate).toBe('2026-08-03')
  })
})

describe('GET /api/admin/feed', () => {
  it('returns a NON-EMPTY list to a region admin for their own region', async () => {
    const res = await listFeed(req('GET', '/api/admin/feed', { token: asCaller(BEDROCK_UID) }))
    expect(res.status).toBe(200)

    const { posts } = await json<{ posts: PostRow[] }>(res)
    expect(posts.length).toBeGreaterThan(0)
    expect(posts.map(p => p.id)).toContain('post-bedrock')
  })

  it('shows a region admin only their own region', async () => {
    const res = await listFeed(req('GET', '/api/admin/feed', { token: asCaller(SACTOWN_UID) }))
    const { posts } = await json<{ posts: PostRow[] }>(res)

    expect(posts.map(p => p.id)).toEqual(['post-sactown'])
  })

  it('shows a superadmin every region', async () => {
    const res = await listFeed(req('GET', '/api/admin/feed', { token: asCaller(SUPER_UID) }))
    const { posts } = await json<{ posts: PostRow[] }>(res)

    expect(posts.map(p => p.id).sort()).toEqual(['post-bedrock', 'post-sactown'])
  })

  it('ignores a ?regionId= the caller does not govern', async () => {
    // The filter is a convenience for the superadmin's region picker. A region
    // admin naming someone else's region must not widen their view.
    const res = await listFeed(req('GET', '/api/admin/feed', {
      token: asCaller(SACTOWN_UID),
      search: { regionId: 'bedrock' },
    }))
    const { posts } = await json<{ posts: PostRow[] }>(res)

    expect(posts.map(p => p.id)).toEqual(['post-sactown'])
  })

  it('honours a ?regionId= the caller does govern', async () => {
    const res = await listFeed(req('GET', '/api/admin/feed', {
      token: asCaller(SUPER_UID),
      search: { regionId: 'bedrock' },
    }))
    const { posts } = await json<{ posts: PostRow[] }>(res)

    expect(posts.map(p => p.id)).toEqual(['post-bedrock'])
  })

  it('omits soft-deleted posts', async () => {
    await seedPost({ id: 'post-gone', authorId: 'pax-bedrock', regionId: 'bedrock', deleted: true })
    const res = await listFeed(req('GET', '/api/admin/feed', { token: asCaller(BEDROCK_UID) }))
    const { posts } = await json<{ posts: PostRow[] }>(res)

    expect(posts.map(p => p.id)).not.toContain('post-gone')
  })
})

// ── 3 + 4 + 6: cross-region mutations ────────────────────────────────────────

describe('cross-region mutations', () => {
  it('refuses a region admin a PATCH on a user in another region', async () => {
    const res = await patchUser(
      req('PATCH', '/api/admin/users/pax-bedrock', {
        token: asCaller(SACTOWN_UID),
        body: { action: 'archive' },
      }),
      ctx({ userId: 'pax-bedrock' })
    )

    expect(res.status).toBe(403)
    expect(await getUser('pax-bedrock')).not.toHaveProperty('status')
  })

  it('refuses a region admin a DELETE on a post in another region', async () => {
    const res = await deletePost(
      req('DELETE', '/api/admin/feed/post-bedrock', { token: asCaller(SACTOWN_UID) }),
      ctx({ postId: 'post-bedrock' })
    )

    expect(res.status).toBe(403)
    expect(await getPost('post-bedrock')).toMatchObject({ deleted: false })
  })

  it('lets a superadmin do both', async () => {
    const archived = await patchUser(
      req('PATCH', '/api/admin/users/pax-bedrock', {
        token: asCaller(SUPER_UID),
        body: { action: 'archive' },
      }),
      ctx({ userId: 'pax-bedrock' })
    )
    expect(archived.status).toBe(200)

    const removed = await deletePost(
      req('DELETE', '/api/admin/feed/post-sactown', { token: asCaller(SUPER_UID) }),
      ctx({ postId: 'post-sactown' })
    )
    expect(removed.status).toBe(200)
  })

  it('takes the region from the target document, not the request body', async () => {
    // The escalation this guards: a Sactown admin claiming the target is in
    // Sactown. `assertRegion` is fed `resolveRegion(user.regionId)`, so the
    // body is inert — but only a test proves it stays that way.
    const res = await patchUser(
      req('PATCH', '/api/admin/users/pax-bedrock', {
        token: asCaller(SACTOWN_UID),
        body: { action: 'archive', regionId: 'sactown' },
      }),
      ctx({ userId: 'pax-bedrock' })
    )

    expect(res.status).toBe(403)
    expect(await getUser('pax-bedrock')).not.toHaveProperty('status')
  })

  it('takes a post\'s region from the post, not a query parameter', async () => {
    const res = await deletePost(
      req('DELETE', '/api/admin/feed/post-bedrock', {
        token: asCaller(SACTOWN_UID),
        search: { regionId: 'sactown' },
      }),
      ctx({ postId: 'post-bedrock' })
    )

    expect(res.status).toBe(403)
    expect(await getPost('post-bedrock')).toMatchObject({ deleted: false })
  })

  it('authenticates before it reads, so a 404 leaks nothing', async () => {
    // An unauthenticated probe must not be able to tell a real user id from a
    // made-up one.
    noValidTokens()
    const res = await patchUser(
      req('PATCH', '/api/admin/users/pax-bedrock', {
        token: 'anything',
        body: { action: 'archive' },
      }),
      ctx({ userId: 'pax-bedrock' })
    )
    expect(res.status).toBe(401)
  })
})

// ── 5: authentication ────────────────────────────────────────────────────────

/**
 * Every admin endpoint that requires an existing admin record, as a callable
 * taking the bearer token to send. Table-driven so a new endpoint that forgets
 * its auth gate has to be added here to pass — and can't be added silently.
 */
const guarded: [string, (token: string) => Promise<Response>][] = [
  ['GET /users',   t => listUsers(req('GET', '/api/admin/users', { token: t }))],
  ['GET /feed',    t => listFeed(req('GET', '/api/admin/feed', { token: t }))],
  ['GET /admins',  t => listAdmins(req('GET', '/api/admin/admins', { token: t }))],
  ['GET /invites', t => listInvites(req('GET', '/api/admin/invites', { token: t }))],
  ['POST /invites', t => createInvite(req('POST', '/api/admin/invites', { token: t, body: {} }))],
  ['PATCH /users/:id', t => patchUser(
    req('PATCH', '/api/admin/users/pax-bedrock', { token: t, body: { action: 'archive' } }),
    ctx({ userId: 'pax-bedrock' })
  )],
  ['DELETE /feed/:id', t => deletePost(
    req('DELETE', '/api/admin/feed/post-bedrock', { token: t }),
    ctx({ postId: 'post-bedrock' })
  )],
]

describe('authentication', () => {
  it.each(guarded)('%s → 401 on an unverifiable token', async (_name, call) => {
    noValidTokens()
    const res = await call('not-a-real-token')
    expect(res.status).toBe(401)
  })

  it('401s when the Authorization header is missing entirely', async () => {
    const res = await listUsers(req('GET', '/api/admin/users'))
    expect(res.status).toBe(401)
    expect(await json<{ error: string }>(res)).toEqual({ error: 'Missing bearer token' })
  })

  it('401s on a malformed Authorization header', async () => {
    const request = req('GET', '/api/admin/users')
    request.headers.set('authorization', 'token-for-uid-superadmin')
    const res = await listUsers(request)
    expect(res.status).toBe(401)
  })

  it('401s when the token verifies but the email is unverified', async () => {
    const token = asCaller(SUPER_UID, { email_verified: false })
    const res = await listUsers(req('GET', '/api/admin/users', { token }))
    expect(res.status).toBe(401)
  })

  it.each(guarded)('%s → 403 for a valid token with no admins/{uid} doc', async (_name, call) => {
    // Signed in with Google, definitely a real person, granted nothing.
    const res = await call(asCaller(STRANGER_UID))

    expect(res.status).toBe(403)
    expect(await json<{ error: string }>(res)).toEqual({ error: 'Not an admin' })
  })

  it('gives a region admin with no regions an empty list, not a crash', async () => {
    // `regionIds: []` is reachable — a superadmin can strip the last region.
    // The endpoint short-circuits rather than sending an empty `in` filter,
    // which Firestore rejects.
    await seedAdmin('uid-no-regions', { role: 'regionAdmin', regionIds: [] })

    const users = await listUsers(req('GET', '/api/admin/users', { token: asCaller('uid-no-regions') }))
    expect(users.status).toBe(200)
    expect(await json<{ users: UserRow[] }>(users)).toEqual({ users: [] })

    const feed = await listFeed(req('GET', '/api/admin/feed', { token: asCaller('uid-no-regions') }))
    expect(feed.status).toBe(200)
    expect(await json<{ posts: PostRow[] }>(feed)).toEqual({ posts: [] })
  })
})

// ── superadmin-only endpoints ────────────────────────────────────────────────

describe('superadmin-only endpoints', () => {
  it.each([
    ['GET /admins',   () => listAdmins(req('GET', '/api/admin/admins', { token: asCaller(BEDROCK_UID) }))],
    ['GET /invites',  () => listInvites(req('GET', '/api/admin/invites', { token: asCaller(BEDROCK_UID) }))],
    ['POST /invites', () => createInvite(req('POST', '/api/admin/invites', {
      token: asCaller(BEDROCK_UID), body: { role: 'regionAdmin', regionIds: ['bedrock'] },
    }))],
  ])('%s refuses a region admin', async (_name, call) => {
    const res = await call()
    expect(res.status).toBe(403)
    expect(await json<{ error: string }>(res)).toEqual({ error: 'Superadmin only' })
  })
})
