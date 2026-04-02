'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { MentionAutocomplete } from './MentionAutocomplete'
import { updateFeedPost } from '@/lib/firestore'
import { extractHashtags, extractMentionNames } from '@/lib/utils'
import { useUser } from '@/contexts/UserContext'
import type { FeedPost, User } from '@/types'

const MAX_CHARS = 500

interface EditPostModalProps {
  open: boolean
  post: FeedPost
  onClose: () => void
}

export function EditPostModal({ open, post, onClose }: EditPostModalProps) {
  const { currentUser, allUsers } = useUser()
  const [content, setContent]           = useState(post.content)
  const [submitting, setSubmitting]     = useState(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync content when post changes (e.g., modal reopened for a different post)
  useEffect(() => {
    setContent(post.content)
    setMentionQuery(null)
  }, [post.id, post.content])

  const handleClose = useCallback(() => {
    setMentionQuery(null)
    onClose()
  }, [onClose])

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    if (val.length > MAX_CHARS) return
    setContent(val)

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

    const replaced = textBeforeCursor.replace(/@([\w ]*)$/, `@${user.displayName} `)
    const newContent = replaced + textAfterCursor
    if (newContent.length <= MAX_CHARS) setContent(newContent)

    setMentionQuery(null)
    textareaRef.current.focus()
  }

  async function handleSubmit() {
    if (!currentUser || !content.trim() || submitting) return

    setSubmitting(true)
    try {
      const mentionedNames = extractMentionNames(content)
      const mentions = allUsers
        .filter(u => mentionedNames.some(name => name.toLowerCase() === u.displayName.toLowerCase()))
        .map(u => u.id)

      await updateFeedPost(post.id, {
        content: content.trim(),
        hashtags: extractHashtags(content),
        mentions,
      })

      handleClose()
    } finally {
      setSubmitting(false)
    }
  }

  const remaining = MAX_CHARS - content.length
  const canSubmit = content.trim().length > 0 && content.trim() !== post.content.trim() && !submitting

  return (
    <Modal open={open} onClose={handleClose} title="Edit Post">
      <div className="flex flex-col gap-4">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={e => {
              if (e.key === 'Escape' && mentionQuery !== null) {
                e.stopPropagation()
                setMentionQuery(null)
              }
            }}
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
              Save
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
