'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { EditPostModal } from './EditPostModal'
import { CommentThread } from './CommentThread'
import { ReactionBar } from './ReactionBar'
import { softDeletePost, togglePostReaction } from '@/lib/firestore'
import { timeAgo, highlightMentions, cn } from '@/lib/utils'
import { useUser } from '@/contexts/UserContext'
import type { FeedPost as FeedPostType } from '@/types'

interface FeedPostProps {
  post: FeedPostType
}

// ─── Regular post ─────────────────────────────────────────────────────────────

function PostBody({ post }: { post: FeedPostType }) {
  const { allUsers } = useUser()

  // Build a version of highlightMentions that wraps @mentions in links
  // by replacing the orange spans with linked spans after rendering.
  // We inject data-mention-name so a post-processing step can add hrefs.
  function buildContent() {
    // Replace @mentions with linked spans
    const html = post.content
      .replace(
        /@([\w ]+)/g,
        (_, name: string) => {
          const user = allUsers.find(
            u => u.displayName.toLowerCase() === name.trim().toLowerCase()
          )
          if (user) {
            return `<a href="/profile/${user.id}" class="text-orange-400 font-semibold hover:underline">@${name}</a>`
          }
          return `<span class="text-orange-400 font-semibold">@${name}</span>`
        }
      )
      .replace(/#(\w+)/g, '<span class="text-green-400">#$1</span>')

    return html
  }

  return (
    <p
      className="text-sm text-zinc-200 leading-relaxed break-words"
      dangerouslySetInnerHTML={{ __html: buildContent() }}
    />
  )
}

// ─── Kebab menu ───────────────────────────────────────────────────────────────

interface KebabMenuProps {
  onEdit: () => void
  onDelete: () => void
}

function KebabMenu({ onEdit, onDelete }: KebabMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="text-zinc-500 hover:text-zinc-300 p-2 rounded-lg hover:bg-zinc-800 transition-colors -mr-2 -mt-1"
        aria-label="Post options"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5"  r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-36 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl z-10 overflow-hidden">
          <button
            onClick={() => { setOpen(false); onEdit() }}
            className="flex items-center gap-2 w-full px-4 py-3 text-sm text-left text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
          <button
            onClick={() => { setOpen(false); onDelete() }}
            className="flex items-center gap-2 w-full px-4 py-3 text-sm text-left text-red-400 hover:bg-zinc-700 transition-colors"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Delete confirmation ───────────────────────────────────────────────────────

interface DeleteConfirmProps {
  onConfirm: () => void
  onCancel: () => void
  deleting: boolean
}

function DeleteConfirm({ onConfirm, onCancel, deleting }: DeleteConfirmProps) {
  return (
    <div className="mt-3 flex items-center gap-3 bg-zinc-800 rounded-xl px-4 py-3">
      <span className="text-xs text-zinc-400 flex-1">Delete this post?</span>
      <button
        onClick={onCancel}
        className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-zinc-700 transition-colors"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={deleting}
        className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50"
      >
        {deleting ? 'Deleting…' : 'Delete'}
      </button>
    </div>
  )
}

// ─── Main FeedPost component ──────────────────────────────────────────────────

export function FeedPost({ post }: FeedPostProps) {
  const { currentUser, allUsers } = useUser()
  const [editOpen, setEditOpen]           = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting]           = useState(false)
  const [threadOpen, setThreadOpen]       = useState(false)

  const isAuthor = currentUser?.id === post.authorId
  const author   = allUsers.find(u => u.id === post.authorId)
  const target   = post.targetUserId ? allUsers.find(u => u.id === post.targetUserId) : undefined

  const handleDelete = useCallback(async () => {
    setDeleting(true)
    try {
      await softDeletePost(post.id)
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }, [post.id])

  // ── System post ─────────────────────────────────────────────────────────────
  if (post.type === 'system') {
    return (
      <article className="px-4 py-3 bg-zinc-800/60 rounded-xl mx-4 my-1 animate-in fade-in duration-300">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-xs text-zinc-400 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: highlightMentions(post.content) }}
            />
            <span className="text-[10px] text-zinc-600 mt-1 block">{timeAgo(post.createdAt)}</span>
          </div>
        </div>
      </article>
    )
  }

  // ── Shoutout post ───────────────────────────────────────────────────────────
  if (post.type === 'shoutout') {
    return (
      <>
        <article className="px-4 py-4 border-l-4 border-orange-500 bg-orange-500/5 mx-4 my-1 rounded-r-xl animate-in fade-in duration-300">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            {author && (
              <Link href={`/profile/${author.id}`} className="shrink-0">
                <Avatar name={author.displayName} size="sm" />
              </Link>
            )}
            <span className="text-xl">💪</span>
            {target && (
              <Link href={`/profile/${target.id}`} className="shrink-0">
                <Avatar name={target.displayName} size="sm" />
              </Link>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-400 leading-snug">
                <Link href={`/profile/${post.authorId}`} className="text-orange-400 font-semibold hover:underline">
                  @{author?.displayName ?? 'Someone'}
                </Link>
                {' shouted out '}
                {target && (
                  <Link href={`/profile/${target.id}`} className="text-orange-400 font-semibold hover:underline">
                    @{target.displayName}
                  </Link>
                )}
              </p>
              <span className="text-[10px] text-zinc-600">{timeAgo(post.createdAt)}</span>
            </div>
            {isAuthor && (
              <KebabMenu
                onEdit={() => setEditOpen(true)}
                onDelete={() => setConfirmDelete(true)}
              />
            )}
          </div>

          {/* Content */}
          <p
            className="text-sm text-zinc-200 leading-relaxed break-words"
            dangerouslySetInnerHTML={{ __html: highlightMentions(post.content) }}
          />

          {/* Actions row */}
          <div className="flex items-center gap-3 mt-2.5">
            <ReactionBar
              reactions={post.reactions}
              currentUserId={currentUser?.id}
              onToggle={emoji => {
                if (!currentUser) return
                const hasReacted = post.reactions?.[emoji]?.includes(currentUser.id) ?? false
                togglePostReaction(post.id, emoji, currentUser.id, hasReacted)
              }}
            />
            <button
              onClick={() => setThreadOpen(v => !v)}
              className={cn('inline-flex items-center transition-colors', threadOpen ? 'text-orange-400' : 'text-zinc-500 hover:text-zinc-300')}
              aria-label="Comments"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
          </div>

          {confirmDelete && (
            <DeleteConfirm
              onConfirm={handleDelete}
              onCancel={() => setConfirmDelete(false)}
              deleting={deleting}
            />
          )}
        </article>

        {threadOpen && <CommentThread post={post} />}

        {editOpen && (
          <EditPostModal
            open={editOpen}
            post={post}
            onClose={() => setEditOpen(false)}
          />
        )}
      </>
    )
  }

  // ── Regular post ────────────────────────────────────────────────────────────
  return (
    <>
      <article className="px-4 py-4 animate-in fade-in duration-300">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          {author && (
            <Link href={`/profile/${author.id}`} className="shrink-0 mt-0.5">
              <Avatar name={author.displayName} size="sm" />
            </Link>
          )}

          <div className="flex-1 min-w-0">
            {/* Author row */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-baseline gap-2 min-w-0">
                <Link
                  href={`/profile/${post.authorId}`}
                  className="text-sm font-semibold text-white hover:text-orange-400 transition-colors truncate"
                >
                  {author?.displayName ?? 'Unknown'}
                </Link>
                <span className="text-[11px] text-zinc-500 shrink-0">{timeAgo(post.createdAt)}</span>
                {post.updatedAt && (
                  <span className="text-[10px] text-zinc-600 shrink-0">· edited</span>
                )}
              </div>
              {isAuthor && (
                <KebabMenu
                  onEdit={() => setEditOpen(true)}
                  onDelete={() => setConfirmDelete(true)}
                />
              )}
            </div>

            {/* Content */}
            <PostBody post={post} />

            {/* Actions row */}
            <div className="flex items-center gap-3 mt-2.5">
              <ReactionBar
                reactions={post.reactions}
                currentUserId={currentUser?.id}
                onToggle={emoji => {
                  if (!currentUser) return
                  const hasReacted = post.reactions?.[emoji]?.includes(currentUser.id) ?? false
                  togglePostReaction(post.id, emoji, currentUser.id, hasReacted)
                }}
              />
              <button
                onClick={() => setThreadOpen(v => !v)}
                className={cn('transition-colors', threadOpen ? 'text-orange-400' : 'text-zinc-500 hover:text-zinc-300')}
                aria-label="Comments"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </button>
            </div>

            {/* Delete confirm inline */}
            {confirmDelete && (
              <DeleteConfirm
                onConfirm={handleDelete}
                onCancel={() => setConfirmDelete(false)}
                deleting={deleting}
              />
            )}
          </div>
        </div>
      </article>

      {threadOpen && <CommentThread post={post} />}

      {editOpen && (
        <EditPostModal
          open={editOpen}
          post={post}
          onClose={() => setEditOpen(false)}
        />
      )}
    </>
  )
}
