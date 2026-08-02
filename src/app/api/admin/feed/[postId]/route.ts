import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { requireAnyAdmin, assertRegion, auditWrite, adminErrorResponse, AdminAuthError } from '@/lib/admin-auth'
import { resolveRegion } from '@/lib/challenges'
import type { FeedPost, FeedComment } from '@/types'

/**
 * DELETE /api/admin/feed/[postId] — remove a post, or one of its comments
 * via ?commentId=.
 *
 * Soft delete, matching what the app already does when an author removes their
 * own: the document stays and gets `deleted: true`, and every feed query
 * filters on it. Firestore rules block hard deletes on this collection
 * outright, so nothing here can actually destroy content.
 *
 * These write through the Admin SDK rather than reusing softDeletePost /
 * softDeleteComment from src/lib/firestore.ts — those close over the browser
 * Firestore instance and can't run on the server.
 *
 * The author is not notified. Removal is silent, exactly like a self-delete;
 * the audit entry is the record that it happened and who did it.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params
    const commentId = req.nextUrl.searchParams.get('commentId')

    // Authenticate first — see the note in the users route.
    const principal = await requireAnyAdmin(req)

    const postRef = adminDb.collection('feed').doc(postId)
    const postSnap = await postRef.get()
    if (!postSnap.exists) {
      return NextResponse.json({ error: 'Unknown post' }, { status: 404 })
    }
    const post = postSnap.data() as FeedPost

    // Scope comes from the post's own region, never the request.
    const regionId = resolveRegion(post.regionId).id
    assertRegion(principal, regionId)

    const batch = adminDb.batch()

    if (commentId) {
      const commentRef = postRef.collection('comments').doc(commentId)
      const commentSnap = await commentRef.get()
      if (!commentSnap.exists) {
        return NextResponse.json({ error: 'Unknown comment' }, { status: 404 })
      }
      const comment = commentSnap.data() as FeedComment
      if (comment.deleted) throw new AdminAuthError(409, 'Already removed')

      batch.update(commentRef, { deleted: true })
      const audit = auditWrite({
        actor: principal,
        action: 'comment.remove',
        targetType: 'comment',
        targetId: `${postId}/${commentId}`,
        regionId,
        before: { authorId: comment.authorId, content: comment.content },
      })
      batch.set(audit.ref, audit.data)
    } else {
      if (post.deleted) throw new AdminAuthError(409, 'Already removed')

      batch.update(postRef, { deleted: true })
      const audit = auditWrite({
        actor: principal,
        action: 'post.remove',
        targetType: 'post',
        targetId: postId,
        regionId,
        before: { authorId: post.authorId, content: post.content, createdAt: post.createdAt },
      })
      batch.set(audit.ref, audit.data)
    }

    await batch.commit()
    return NextResponse.json({ ok: true })
  } catch (err) {
    const { status, body } = adminErrorResponse(err)
    return NextResponse.json(body, { status })
  }
}
