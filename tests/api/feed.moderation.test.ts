/**
 * DELETE /api/admin/feed/[postId] — soft-remove a post or one of its comments.
 *
 * Region scope comes from the post document in both cases, comments included:
 * a comment has no region of its own, so its parent's is the only correct
 * answer and the only one that can't be supplied by the caller.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { adminDb } from '@/lib/firebase-admin'
import { DELETE } from '@/app/api/admin/feed/[postId]/route'
import { GET as listFeed } from '@/app/api/admin/feed/route'
import {
  asCaller, auditEntries, clearDb, ctx, getPost, json, req,
  seedAdmins, seedComment, seedPost, seedUser,
  BEDROCK_UID, SACTOWN_UID, SUPER_UID,
} from './harness'

function remove(token: string, postId: string, commentId?: string) {
  return DELETE(
    req('DELETE', `/api/admin/feed/${postId}`, {
      token,
      ...(commentId ? { search: { commentId } } : {}),
    }),
    ctx({ postId })
  )
}

async function getComment(postId: string, commentId: string) {
  const snap = await adminDb.collection('feed').doc(postId)
    .collection('comments').doc(commentId).get()
  return snap.exists ? (snap.data() as Record<string, unknown>) : undefined
}

beforeEach(async () => {
  await clearDb()
  await seedAdmins()
  await seedUser({ id: 'pax-1', displayName: 'Splice', regionId: 'bedrock' })
  await seedPost({ id: 'post-1', authorId: 'pax-1', regionId: 'bedrock', content: 'a bad post' })
})

describe('removing a post', () => {
  it('soft-deletes rather than destroying it', async () => {
    const res = await remove(asCaller(BEDROCK_UID), 'post-1')
    expect(res.status).toBe(200)

    // The document survives; Firestore rules block hard deletes on `feed`
    // outright, and every feed query filters on `deleted`.
    expect(await getPost('post-1')).toMatchObject({ deleted: true, content: 'a bad post' })
  })

  it('drops the post out of the moderation list', async () => {
    await remove(asCaller(BEDROCK_UID), 'post-1')

    const res = await listFeed(req('GET', '/api/admin/feed', { token: asCaller(BEDROCK_UID) }))
    const { posts } = await json<{ posts: { id: string }[] }>(res)
    expect(posts).toHaveLength(0)
  })

  it('409s on a post that is already removed', async () => {
    const token = asCaller(SUPER_UID)
    await remove(token, 'post-1')

    const res = await remove(token, 'post-1')
    expect(res.status).toBe(409)
  })

  it('404s on an unknown post', async () => {
    const res = await remove(asCaller(SUPER_UID), 'no-such-post')
    expect(res.status).toBe(404)
  })

  it('records the removed content in the audit entry', async () => {
    await remove(asCaller(BEDROCK_UID), 'post-1')

    const [entry] = await auditEntries('post.remove')
    expect(entry).toMatchObject({
      actorUid: BEDROCK_UID,
      targetType: 'post',
      targetId: 'post-1',
      regionId: 'bedrock',
    })
    // The audit log is the only surviving copy of what was taken down.
    expect(entry.before).toMatchObject({ authorId: 'pax-1', content: 'a bad post' })
  })
})

describe('removing a comment', () => {
  beforeEach(async () => {
    await seedComment('post-1', 'c-1', { authorId: 'pax-1', content: 'a bad comment' })
  })

  it('soft-deletes the comment and leaves the post alone', async () => {
    const res = await remove(asCaller(BEDROCK_UID), 'post-1', 'c-1')
    expect(res.status).toBe(200)

    expect(await getComment('post-1', 'c-1')).toMatchObject({ deleted: true })
    expect(await getPost('post-1')).toMatchObject({ deleted: false })
  })

  it('409s on a comment that is already removed', async () => {
    const token = asCaller(BEDROCK_UID)
    await remove(token, 'post-1', 'c-1')

    const res = await remove(token, 'post-1', 'c-1')
    expect(res.status).toBe(409)
  })

  it('404s on an unknown comment under a real post', async () => {
    const res = await remove(asCaller(BEDROCK_UID), 'post-1', 'no-such-comment')
    expect(res.status).toBe(404)
  })

  it('scopes a comment by its PARENT POST\'s region', async () => {
    // A comment carries no regionId. If scope were ever taken from anywhere
    // other than the post, a Sactown admin could reach into a Bedrock thread.
    const res = await remove(asCaller(SACTOWN_UID), 'post-1', 'c-1')
    expect(res.status).toBe(403)
    expect(await getComment('post-1', 'c-1')).toMatchObject({ deleted: false })
  })

  it('audits with a composite target id', async () => {
    await remove(asCaller(SUPER_UID), 'post-1', 'c-1')

    const [entry] = await auditEntries('comment.remove')
    expect(entry).toMatchObject({
      targetType: 'comment',
      targetId: 'post-1/c-1',
      regionId: 'bedrock',
    })
    expect(entry.before).toMatchObject({ content: 'a bad comment' })
  })
})

describe('audit', () => {
  it('writes nothing when the removal is refused', async () => {
    await remove(asCaller(SACTOWN_UID), 'post-1')
    await remove(asCaller(SUPER_UID), 'no-such-post')

    expect(await auditEntries()).toHaveLength(0)
  })
})
