'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { MentionAutocomplete } from './MentionAutocomplete'
import { ImageUploadStrip } from './ImageUploadStrip'
import { useFeedImages } from '@/hooks/useFeedImages'
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
  const images = useFeedImages(post.imageUrls ?? [])
  const { reset: resetImages } = images
  const lastPostId = useRef(post.id)

  // Re-init only when the modal is reused for a *different* post. State is
  // already seeded from props on mount, so we must not re-run on same-id
  // re-renders — the feed's onSnapshot hands us a new post object (with a
  // fresh imageUrls array) on any feed activity, which would otherwise wipe
  // the user's unsaved edits mid-typing.
  useEffect(() => {
    if (lastPostId.current === post.id) return
    lastPostId.current = post.id
    setContent(post.content)
    setMentionQuery(null)
    resetImages(post.imageUrls ?? [])
  }, [post.id, post.content, post.imageUrls, resetImages])

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
    if (!currentUser || submitting) return
    if (!content.trim() && images.doneUrls.length === 0) return

    setSubmitting(true)
    try {
      const mentionedNames = extractMentionNames(content, allUsers)
      const mentions = allUsers
        .filter(u => mentionedNames.some(name => name.toLowerCase() === u.displayName.toLowerCase()))
        .map(u => u.id)

      await updateFeedPost(post.id, {
        content: content.trim(),
        hashtags: extractHashtags(content),
        mentions,
        imageUrls: images.doneUrls,
      })

      handleClose()
    } finally {
      setSubmitting(false)
    }
  }

  const remaining = MAX_CHARS - content.length
  const contentChanged = content.trim() !== post.content.trim()
  const imagesChanged =
    images.doneUrls.length !== (post.imageUrls?.length ?? 0) ||
    images.doneUrls.some((url, i) => url !== post.imageUrls?.[i])
  const hasBody = content.trim().length > 0 || images.doneUrls.length > 0
  const canSubmit =
    hasBody && (contentChanged || imagesChanged) && !submitting && !images.isUploading

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

        <ImageUploadStrip
          items={images.items}
          canAddMore={images.canAddMore}
          disabled={submitting}
          onAdd={images.addFiles}
          onRemove={images.remove}
        />

        <div className="flex items-center justify-between">
          {images.isUploading ? (
            <span className="text-xs text-orange-400">Uploading photos…</span>
          ) : (
            <span className={`text-xs tabular-nums ${remaining < 50 ? 'text-orange-400' : 'text-zinc-500'}`}>
              {remaining} left
            </span>
          )}
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
