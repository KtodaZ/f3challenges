'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { MentionAutocomplete } from './MentionAutocomplete'
import { ImageUploadStrip } from './ImageUploadStrip'
import { VideoUploadStrip } from './VideoUploadStrip'
import { useFeedImages } from '@/hooks/useFeedImages'
import { useFeedVideos } from '@/hooks/useFeedVideos'
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
  // `allUsers` (directory) resolves names already typed into the post — an
  // archived PAX must keep resolving. `roster` only feeds the suggestion list,
  // so nobody can newly @-mention someone who has left the crew.
  const { currentUser, allUsers, roster } = useUser()
  const [content, setContent]           = useState('')
  const [submitting, setSubmitting]     = useState(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const images = useFeedImages()
  const videos = useFeedVideos()
  const { reset: resetImages } = images
  const { reset: resetVideos } = videos

  const handleClose = useCallback(() => {
    setContent('')
    setMentionQuery(null)
    resetImages()
    resetVideos()
    onClose()
  }, [onClose, resetImages, resetVideos])

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
    if (!currentUser || submitting) return
    if (!content.trim() && images.doneUrls.length === 0 && videos.doneUrls.length === 0) return

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
        authorName: currentUser.displayName,
        content: content.trim(),
        hashtags: extractHashtags(content),
        mentions,
        imageUrls: images.doneUrls.length ? images.doneUrls : undefined,
        videoUrls: videos.doneUrls.length ? videos.doneUrls : undefined,
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

  // Users mentioned in the current content who have no FCM tokens
  const noNotifMentions = useMemo(() => {
    const names = extractMentionNames(content, allUsers)
    return allUsers.filter(u =>
      u.id !== currentUser?.id &&
      names.some(n => n.toLowerCase() === u.displayName.toLowerCase()) &&
      !u.fcmTokens?.length
    )
  }, [content, allUsers, currentUser?.id])

  const remaining = MAX_CHARS - content.length
  const mediaUploading = images.isUploading || videos.isUploading
  const canSubmit =
    (content.trim().length > 0 || images.doneUrls.length > 0 || videos.doneUrls.length > 0) &&
    !submitting &&
    !mediaUploading

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
              users={roster.filter(u => u.id !== currentUser?.id)}
              onSelect={handleMentionSelect}
            />
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <ImageUploadStrip
            items={images.items}
            canAddMore={images.canAddMore}
            disabled={submitting}
            onAdd={images.addFiles}
            onRemove={images.remove}
            onRetry={images.retry}
          />

          <VideoUploadStrip
            items={videos.items}
            canAddMore={videos.canAddMore}
            disabled={submitting}
            onAdd={videos.addFiles}
            onRemove={videos.remove}
            onRetry={videos.retry}
          />
        </div>

        {noNotifMentions.length > 0 && (
          <div className="flex items-start gap-2.5 p-3 bg-amber-900/20 border border-amber-700/40 rounded-xl">
            <span className="text-base leading-none mt-0.5">🔕</span>
            <p className="text-xs text-amber-300">
              {noNotifMentions.map(u => u.displayName).join(', ')}
              {noNotifMentions.length === 1 ? ' hasn\'t' : ' haven\'t'} set up push notifications — {noNotifMentions.length === 1 ? 'they' : 'they'} may not see this post.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          {mediaUploading ? (
            <span className="text-xs text-orange-400">Uploading media…</span>
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
              Post
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
