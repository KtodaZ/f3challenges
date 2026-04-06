'use client'

import { useState, useRef, useCallback } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { MentionAutocomplete } from './MentionAutocomplete'
import { createFeedPost, createNotification } from '@/lib/firestore'
import { generateId, extractHashtags, extractMentionNames } from '@/lib/utils'
import { useUser } from '@/contexts/UserContext'
import type { User } from '@/types'

const MAX_CHARS = 500

interface NewPostModalProps {
  open: boolean
  onClose: () => void
}

export function NewPostModal({ open, onClose }: NewPostModalProps) {
  const { currentUser, allUsers } = useUser()
  const [content, setContent]           = useState('')
  const [submitting, setSubmitting]     = useState(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleClose = useCallback(() => {
    setContent('')
    setMentionQuery(null)
    onClose()
  }, [onClose])

  /** Track @ typing to surface mention autocomplete. */
  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    if (val.length > MAX_CHARS) return
    setContent(val)

    // Detect if cursor is right after an @ — extract the partial name
    const cursor = e.target.selectionStart ?? val.length
    const textBeforeCursor = val.slice(0, cursor)
    const atMatch = textBeforeCursor.match(/@([\w ]*)$/)
    setMentionQuery(atMatch ? atMatch[1] : null)
  }

  function handleMentionSelect(user: User) {
    if (!textareaRef.current) return
    const cursor = textareaRef.current.selectionStart ?? content.length
    const textBeforeCursor = content.slice(0, cursor)
    const textAfterCursor  = content.slice(cursor)

    // Replace the partial @... with the full display name
    const replaced = textBeforeCursor.replace(/@([\w ]*)$/, `@${user.displayName} `)
    const newContent = replaced + textAfterCursor
    if (newContent.length <= MAX_CHARS) setContent(newContent)

    setMentionQuery(null)
    // Re-focus textarea
    textareaRef.current.focus()
  }

  async function handleSubmit() {
    if (!currentUser || !content.trim() || submitting) return

    setSubmitting(true)
    try {
      const now = new Date().toISOString()
      const postId = generateId()

      // Resolve @mention names → user IDs
      const mentionedNames = extractMentionNames(content, allUsers)
      const mentionedUsers = allUsers.filter(u =>
        mentionedNames.some(name => name.toLowerCase() === u.displayName.toLowerCase())
      )
      const mentions = mentionedUsers.map(u => u.id)

      await createFeedPost({
        id: postId,
        type: 'post',
        authorId: currentUser.id,
        content: content.trim(),
        hashtags: extractHashtags(content),
        mentions,
        createdAt: now,
        deleted: false,
      })

      // Notify each mentioned user (except the author)
      await Promise.all(
        mentionedUsers
          .filter(u => u.id !== currentUser.id)
          .map(u =>
            createNotification({
              id: generateId(),
              userId: u.id,
              type: 'mention',
              title: `${currentUser.displayName} mentioned you`,
              body: content.trim().slice(0, 100),
              read: false,
              createdAt: now,
              relatedPostId: postId,
              relatedUserId: currentUser.id,
            })
          )
      )

      handleClose()
    } finally {
      setSubmitting(false)
    }
  }

  const remaining = MAX_CHARS - content.length
  const canSubmit = content.trim().length > 0 && !submitting

  return (
    <Modal open={open} onClose={handleClose} title="New Post">
      <div className="flex flex-col gap-4">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={e => {
              // Dismiss autocomplete on Escape without closing modal
              if (e.key === 'Escape' && mentionQuery !== null) {
                e.stopPropagation()
                setMentionQuery(null)
              }
            }}
            placeholder="What's on your mind? Use #hashtags and @mention your crew..."
            rows={5}
            className="bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 rounded-xl px-4 py-3 text-sm w-full resize-none focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            autoFocus
          />
          {mentionQuery !== null && (
            <MentionAutocomplete
              query={mentionQuery}
              users={allUsers.filter(u => u.id !== currentUser?.id)}
              onSelect={handleMentionSelect}
            />
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className={`text-xs tabular-nums ${remaining < 50 ? 'text-orange-400' : 'text-zinc-500'}`}>
            {remaining} left
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={!canSubmit}
              loading={submitting}
            >
              Post
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
