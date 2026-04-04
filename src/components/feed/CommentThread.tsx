'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { ReactionBar } from './ReactionBar'
import {
  subscribeToComments,
  createComment,
  softDeleteComment,
  toggleCommentReaction,
  createNotification,
} from '@/lib/firestore'
import { generateId, timeAgo, stripUndefined } from '@/lib/utils'
import { useUser } from '@/contexts/UserContext'
import type { FeedPost, FeedComment, User } from '@/types'

// ─── Individual comment row ───────────────────────────────────────────────────

interface CommentRowProps {
  comment: FeedComment
  allUsers: User[]
  currentUserId: string | undefined
  onReply?: () => void
  onDelete: () => void
  onReactionToggle: (emoji: string) => void
}

function CommentRow({
  comment,
  allUsers,
  currentUserId,
  onReply,
  onDelete,
  onReactionToggle,
}: CommentRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const author   = allUsers.find(u => u.id === comment.authorId)
  const isAuthor = currentUserId === comment.authorId

  return (
    <div className="flex items-start gap-2">
      {author && (
        <Link href={`/profile/${author.id}`} className="shrink-0 mt-0.5">
          <Avatar name={author.displayName} size="xs" />
        </Link>
      )}
      <div className="flex-1 min-w-0">
        <div className="bg-zinc-800 rounded-2xl rounded-tl-sm px-3 py-2">
          <div className="flex items-baseline justify-between gap-2 mb-0.5">
            <Link
              href={`/profile/${comment.authorId}`}
              className="text-[11px] font-semibold text-white hover:text-orange-400 transition-colors truncate"
            >
              {author?.displayName ?? 'Unknown'}
            </Link>
            <span className="text-[10px] text-zinc-500 shrink-0">{timeAgo(comment.createdAt)}</span>
          </div>
          <p className="text-xs text-zinc-200 leading-relaxed break-words">{comment.content}</p>
        </div>

        {/* Reactions + actions */}
        <div className="flex items-center gap-2 mt-1 pl-2 flex-wrap">
          <ReactionBar
            reactions={comment.reactions}
            currentUserId={currentUserId}
            onToggle={onReactionToggle}
            size="xs"
          />
          <div className="flex items-center gap-2">
            {onReply && (
              <button
                onClick={onReply}
                className="text-[11px] text-zinc-500 hover:text-zinc-300 font-medium transition-colors"
              >
                Reply
              </button>
            )}
            {isAuthor && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-[11px] text-zinc-600 hover:text-red-400 transition-colors"
              >
                Delete
              </button>
            )}
            {confirmDelete && (
              <>
                <button
                  onClick={onDelete}
                  className="text-[11px] text-red-400 font-medium transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Thread ───────────────────────────────────────────────────────────────────

interface CommentThreadProps {
  post: FeedPost
}

export function CommentThread({ post }: CommentThreadProps) {
  const { currentUser, allUsers } = useUser()
  const [comments, setComments]     = useState<FeedComment[]>([])
  const [inputValue, setInputValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [replyingTo, setReplyingTo] = useState<FeedComment | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return subscribeToComments(post.id, setComments)
  }, [post.id])

  const topLevel   = comments.filter(c => !c.parentCommentId)
  const repliesFor = useCallback(
    (commentId: string) => comments.filter(c => c.parentCommentId === commentId),
    [comments]
  )

  function handleReply(comment: FeedComment) {
    const author = allUsers.find(u => u.id === comment.authorId)
    setReplyingTo(comment)
    setInputValue(author ? `@${author.displayName} ` : '')
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

  const replyAuthor = replyingTo
    ? allUsers.find(u => u.id === replyingTo.authorId)
    : null

  return (
    <div className="border-t border-zinc-800/60 pt-3 pb-3 px-4 flex flex-col gap-3">
      {/* Comment list */}
      {topLevel.length > 0 && (
        <div className="flex flex-col gap-3">
          {topLevel.map(comment => {
            const replies = repliesFor(comment.id)
            return (
              <div key={comment.id} className="flex flex-col gap-2">
                <CommentRow
                  comment={comment}
                  allUsers={allUsers}
                  currentUserId={currentUser?.id}
                  onReply={() => handleReply(comment)}
                  onDelete={() => softDeleteComment(post.id, comment.id)}
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
                        onDelete={() => softDeleteComment(post.id, reply.id)}
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
        </div>
      )}

      {/* Input */}
      {currentUser && (
        <div className="flex flex-col gap-1.5">
          {replyingTo && (
            <div className="flex items-center gap-2 text-[11px] text-zinc-400 pl-8">
              <span>Replying to {replyAuthor?.displayName ?? 'someone'}</span>
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
                placeholder="Add a comment…"
                className="flex-1 bg-transparent text-xs text-white placeholder:text-zinc-500 outline-none"
              />
              {inputValue.trim() && (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
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
