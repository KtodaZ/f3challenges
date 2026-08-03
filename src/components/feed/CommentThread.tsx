'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { AdminBadge } from '@/components/ui/AdminBadge'
import { ReactionBar } from './ReactionBar'
import {
  createComment,
  softDeleteComment,
  toggleCommentReaction,
  createNotification,
} from '@/lib/firestore'
import { generateId, timeAgo, stripUndefined } from '@/lib/utils'
import { useUser } from '@/contexts/UserContext'
import { useRegion } from '@/contexts/RegionContext'
import { useAdminMode } from '@/contexts/AdminModeContext'
import { useAdminRoles } from '@/hooks/useAdminRoles'
import type { FeedPost, FeedComment, User } from '@/types'
import type { AdminRole } from '@/lib/admin-auth'

// ─── Individual comment row ───────────────────────────────────────────────────

interface CommentRowProps {
  comment: FeedComment
  allUsers: User[]
  currentUserId: string | undefined
  /** Lets an admin remove someone else's comment from the thread itself. */
  canModerate?: boolean
  /** Set when this comment's author is an admin — renders the ADMIN tag. */
  authorRole?: AdminRole
  onReply?: () => void
  onDelete: () => void | Promise<void>
  onReactionToggle: (emoji: string) => void
}

function CommentRow({
  comment,
  allUsers,
  currentUserId,
  canModerate = false,
  authorRole,
  onReply,
  onDelete,
  onReactionToggle,
}: CommentRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const author   = allUsers.find(u => u.id === comment.authorId)
  // Falls back to the name stored on the comment for an author this region's
  // roster doesn't contain — an admin commenting from another region.
  const authorName = author?.displayName ?? comment.authorName ?? 'Unknown'
  const isAuthor = currentUserId === comment.authorId
  // The author's own delete stays the plain client write; an admin removing
  // someone else's goes through the audited route. Same control, different path.
  const showDelete = isAuthor || canModerate
  // Moderating says "Remove", so it never reads as though you wrote this.
  const verb = isAuthor ? 'Delete' : 'Remove'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setBusy(true)
    setError(null)
    try {
      // onDelete is async and can reject — the admin check that revealed this
      // control is a display hint, so the server can still refuse.
      await onDelete()
      setConfirmDelete(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove that')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-start gap-2">
      <Link href={`/profile/${comment.authorId}`} className="shrink-0 mt-0.5">
        <Avatar name={authorName} size="xs" />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="bg-zinc-800 rounded-2xl rounded-tl-sm px-3 py-2">
          <div className="flex items-baseline justify-between gap-2 mb-0.5">
            <div className="flex items-baseline gap-1.5 min-w-0">
              <Link
                href={`/profile/${comment.authorId}`}
                className="text-[11px] font-semibold text-white hover:text-orange-400 transition-colors truncate"
              >
                {authorName}
              </Link>
              <AdminBadge role={authorRole} size="xs" />
            </div>
            <span className="text-[10px] text-zinc-500 shrink-0">{timeAgo(comment.createdAt)}</span>
          </div>
          <p className="text-xs text-zinc-200 leading-relaxed break-words">{comment.content}</p>
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-2.5 mt-1 pl-2">
          <ReactionBar
            reactions={comment.reactions}
            currentUserId={currentUserId}
            onToggle={onReactionToggle}
          />
          {onReply && (
            <button
              onClick={onReply}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 font-medium transition-colors"
            >
              Reply
            </button>
          )}
          {showDelete && !confirmDelete && (
            <button
              onClick={() => { setError(null); setConfirmDelete(true) }}
              className="text-[11px] text-zinc-600 hover:text-red-400 transition-colors"
            >
              {verb}
            </button>
          )}
          {confirmDelete && (
            <>
              <button
                onClick={handleDelete}
                disabled={busy}
                className="text-[11px] text-red-400 font-medium transition-colors disabled:opacity-50"
              >
                {busy ? `${verb.slice(0, -1)}ing…` : 'Confirm'}
              </button>
              <button
                onClick={() => { setConfirmDelete(false); setError(null) }}
                className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Cancel
              </button>
            </>
          )}
          {error && <span className="text-[11px] text-red-400">{error}</span>}
        </div>
      </div>
    </div>
  )
}

const MAX_VISIBLE_THREADS = 3

// ─── Thread ───────────────────────────────────────────────────────────────────

interface CommentThreadProps {
  post: FeedPost
  comments: FeedComment[]
}

export function CommentThread({ post, comments }: CommentThreadProps) {
  const { currentUser, allUsers } = useUser()
  const { isAdmin, role, regionIds, removeComment } = useAdminMode()
  const { regionId, socialReadOnly } = useRegion()
  const adminRoles = useAdminRoles()
  // See the note in FeedPost — moderation only where this admin governs.
  const canModerate = isAdmin && (role === 'superadmin' || regionIds.includes(regionId))

  // Removing a comment: the author's own goes straight to Firestore as before,
  // anyone else's goes through the audited admin route.
  function deleteComment(commentId: string, authorId: string) {
    if (currentUser?.id === authorId) return softDeleteComment(post.id, commentId)
    return removeComment(post.id, commentId)
  }
  const [inputValue, setInputValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [replyingTo, setReplyingTo] = useState<FeedComment | null>(null)
  const [showAll, setShowAll]       = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const topLevel   = comments.filter(c => !c.parentCommentId)
  const repliesFor = useCallback(
    (commentId: string) => comments.filter(c => c.parentCommentId === commentId),
    [comments]
  )

  function handleReply(comment: FeedComment) {
    const name = allUsers.find(u => u.id === comment.authorId)?.displayName ?? comment.authorName
    setReplyingTo(comment)
    setInputValue(name ? `@${name} ` : '')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handleCancelReply() {
    setReplyingTo(null)
    setInputValue('')
  }

  async function handleSubmit() {
    if (!currentUser || !inputValue.trim() || submitting) return
    setSubmitting(true)
    try {
      const now       = new Date().toISOString()
      const commentId = generateId()
      const content   = inputValue.trim()

      await createComment(stripUndefined<FeedComment>({
        id: commentId,
        postId: post.id,
        parentCommentId: replyingTo?.id,
        authorId: currentUser.id,
        authorName: currentUser.displayName,
        content,
        createdAt: now,
        deleted: false,
      }))

      // Notifications
      if (!replyingTo) {
        // Top-level comment — notify post author
        if (post.authorId !== currentUser.id) {
          await createNotification({
            id: generateId(),
            userId: post.authorId,
            type: 'comment',
            title: `${currentUser.displayName} commented on your post`,
            body: content.slice(0, 100),
            read: false,
            createdAt: now,
            relatedPostId: post.id,
            relatedUserId: currentUser.id,
          })
        }
      } else {
        // Reply — notify the comment author
        if (replyingTo.authorId !== currentUser.id) {
          await createNotification({
            id: generateId(),
            userId: replyingTo.authorId,
            type: 'reply',
            title: `${currentUser.displayName} replied to your comment`,
            body: content.slice(0, 100),
            read: false,
            createdAt: now,
            relatedPostId: post.id,
            relatedUserId: currentUser.id,
          })
        }
      }

      setInputValue('')
      setReplyingTo(null)
    } finally {
      setSubmitting(false)
    }
  }

  const replyAuthorName = replyingTo
    ? allUsers.find(u => u.id === replyingTo.authorId)?.displayName ?? replyingTo.authorName
    : null

  return (
    <div className="border-t border-zinc-800/60 pt-3 pb-3 px-4 flex flex-col gap-3">
      {/* Comment list */}
      {topLevel.length > 0 && (
        <div className="flex flex-col gap-3">
          {(showAll ? topLevel : topLevel.slice(0, MAX_VISIBLE_THREADS)).map(comment => {
            const replies = repliesFor(comment.id)
            return (
              <div key={comment.id} className="flex flex-col gap-2">
                <CommentRow
                  comment={comment}
                  allUsers={allUsers}
                  currentUserId={currentUser?.id}
                  canModerate={canModerate}
                  authorRole={adminRoles[comment.authorId]}
                  onReply={() => handleReply(comment)}
                  onDelete={() => deleteComment(comment.id, comment.authorId)}
                  onReactionToggle={emoji => {
                    if (!currentUser) return
                    const hasReacted = comment.reactions?.[emoji]?.includes(currentUser.id) ?? false
                    toggleCommentReaction(post.id, comment.id, emoji, currentUser.id, hasReacted)
                  }}
                />
                {replies.length > 0 && (
                  <div className="ml-8 flex flex-col gap-2">
                    {replies.map(reply => (
                      <CommentRow
                        key={reply.id}
                        comment={reply}
                        allUsers={allUsers}
                        currentUserId={currentUser?.id}
                        canModerate={canModerate}
                        authorRole={adminRoles[reply.authorId]}
                        onDelete={() => deleteComment(reply.id, reply.authorId)}
                        onReactionToggle={emoji => {
                          if (!currentUser) return
                          const hasReacted = reply.reactions?.[emoji]?.includes(currentUser.id) ?? false
                          toggleCommentReaction(post.id, reply.id, emoji, currentUser.id, hasReacted)
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {!showAll && topLevel.length > MAX_VISIBLE_THREADS && (
            <button
              onClick={() => setShowAll(true)}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors text-left"
            >
              View {topLevel.length - MAX_VISIBLE_THREADS} more comment{topLevel.length - MAX_VISIBLE_THREADS !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}

      {/* Input */}
      {currentUser && (
        <div className="flex flex-col gap-1.5">
          {replyingTo && (
            <div className="flex items-center gap-2 text-[11px] text-zinc-400 pl-8">
              <span>Replying to {replyAuthorName ?? 'someone'}</span>
              <button
                onClick={handleCancelReply}
                className="text-zinc-600 hover:text-zinc-300 transition-colors"
                aria-label="Cancel reply"
              >
                ✕
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Avatar name={currentUser.displayName} size="xs" />
            <div className="flex-1 flex items-center gap-2 bg-zinc-800 rounded-full px-3 py-1.5 focus-within:ring-1 focus-within:ring-orange-500/50">
              <input
                ref={inputRef}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
                placeholder={socialReadOnly ? 'Read-only while viewing another region' : 'Add a comment…'}
                disabled={socialReadOnly}
                className="flex-1 bg-transparent text-xs text-white placeholder:text-zinc-500 outline-none"
              />
              {inputValue.trim() && (
                <button
                  onClick={handleSubmit}
                  disabled={submitting || socialReadOnly}
                  className="text-orange-400 hover:text-orange-300 text-xs font-semibold shrink-0 transition-colors disabled:opacity-50"
                >
                  {submitting ? '…' : 'Post'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
