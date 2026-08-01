import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { requireAdmin, adminErrorResponse } from '@/lib/admin-auth'
import { REGIONS, resolveRegion } from '@/lib/challenges'
import type { FeedPost, FeedComment, User } from '@/types'

export interface AdminComment {
  id: string
  authorId: string
  authorName: string
  content: string
  createdAt: string
}

export interface AdminPostRow {
  id: string
  type: FeedPost['type']
  authorId: string
  authorName: string
  regionId: string
  content: string
  createdAt: string
  imageCount: number
  comments: AdminComment[]
}

const PAGE_SIZE = 50

/**
 * GET /api/admin/feed — recent posts with their comments, for moderation.
 *
 * Author names are resolved from the full user directory, archived PAX
 * included: a removed-from-the-crew author still wrote the post, and showing
 * an unresolved id would make the thing you're moderating harder to identify.
 */
export async function GET(req: NextRequest) {
  try {
    const principal = await requireAdmin(req)
    const { record } = principal

    const governed = record.role === 'superadmin' ? REGIONS.map(r => r.id) : record.regionIds
    if (governed.length === 0) return NextResponse.json({ posts: [] })

    // A region admin may only ever see their own regions, whatever they ask for.
    const requested = req.nextUrl.searchParams.get('regionId')
    const regionIds = requested && governed.includes(requested) ? [requested] : governed

    const snap = await adminDb.collection('feed')
      .where('regionId', 'in', regionIds.slice(0, 30))
      .where('deleted', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(PAGE_SIZE)
      .get()

    const usersSnap = await adminDb.collection('users').get()
    const nameById = new Map(
      usersSnap.docs.map(d => [d.id, (d.data() as User).displayName ?? d.id])
    )

    const posts: AdminPostRow[] = await Promise.all(
      snap.docs.map(async doc => {
        const post = doc.data() as FeedPost
        const commentsSnap = await doc.ref.collection('comments')
          .where('deleted', '==', false)
          .orderBy('createdAt', 'asc')
          .get()

        return {
          id: doc.id,
          type: post.type,
          authorId: post.authorId,
          authorName: nameById.get(post.authorId) ?? post.authorId,
          regionId: resolveRegion(post.regionId).id,
          content: post.content,
          createdAt: post.createdAt,
          imageCount: (post.imageUrls?.length ?? 0) + (post.videoUrls?.length ?? 0),
          comments: commentsSnap.docs.map(c => {
            const comment = c.data() as FeedComment
            return {
              id: c.id,
              authorId: comment.authorId,
              authorName: nameById.get(comment.authorId) ?? comment.authorId,
              content: comment.content,
              createdAt: comment.createdAt,
            }
          }),
        }
      })
    )

    return NextResponse.json({ posts })
  } catch (err) {
    const { status, body } = adminErrorResponse(err)
    return NextResponse.json(body, { status })
  }
}
