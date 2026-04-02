'use client'

import { useState, useCallback } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { createFeedPost, createNotification } from '@/lib/firestore'
import { generateId, extractHashtags } from '@/lib/utils'
import { useUser } from '@/contexts/UserContext'
import type { User } from '@/types'

const MAX_CHARS = 500
const MIN_CHARS = 10

interface ShoutoutModalProps {
  open: boolean
  targetUser: User
  onClose: () => void
}

export function ShoutoutModal({ open, targetUser, onClose }: ShoutoutModalProps) {
  const { currentUser } = useUser()
  const [content, setContent]       = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleClose = useCallback(() => {
    setContent('')
    onClose()
  }, [onClose])

  async function handleSubmit() {
    if (!currentUser || content.trim().length < MIN_CHARS || submitting) return

    setSubmitting(true)
    try {
      const now    = new Date().toISOString()
      const postId = generateId()

      await createFeedPost({
        id: postId,
        type: 'shoutout',
        authorId: currentUser.id,
        content: content.trim(),
        hashtags: extractHashtags(content),
        mentions: [targetUser.id],
        targetUserId: targetUser.id,
        createdAt: now,
        deleted: false,
      })

      await createNotification({
        id: generateId(),
        userId: targetUser.id,
        type: 'shoutout',
        title: `${currentUser.displayName} shouted you out! 💪`,
        body: content.trim().slice(0, 100),
        read: false,
        createdAt: now,
        relatedPostId: postId,
        relatedUserId: currentUser.id,
      })

      handleClose()
    } finally {
      setSubmitting(false)
    }
  }

  const remaining = MAX_CHARS - content.length
  const canSubmit = content.trim().length >= MIN_CHARS && !submitting

  return (
    <Modal open={open} onClose={handleClose} title={`Shout out @${targetUser.displayName}`}>
      <div className="flex flex-col gap-4">
        {/* Visual header showing both avatars */}
        <div className="flex items-center justify-center gap-3 py-2">
          {currentUser && <Avatar name={currentUser.displayName} size="md" />}
          <span className="text-2xl">💪</span>
          <Avatar name={targetUser.displayName} size="md" />
        </div>

        <p className="text-center text-sm text-zinc-400">
          Shouting out{' '}
          <span className="text-orange-400 font-semibold">@{targetUser.displayName}</span>
        </p>

        <div className="relative">
          <textarea
            value={content}
            onChange={e => {
              if (e.target.value.length <= MAX_CHARS) setContent(e.target.value)
            }}
            placeholder="Write something encouraging..."
            rows={4}
            className="bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 rounded-xl px-4 py-3 text-sm w-full resize-none focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            autoFocus
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className={`text-xs tabular-nums ${remaining < 50 ? 'text-orange-400' : 'text-zinc-500'}`}>
              {remaining} left
            </span>
            {content.trim().length > 0 && content.trim().length < MIN_CHARS && (
              <span className="text-xs text-zinc-500">
                {MIN_CHARS - content.trim().length} more chars needed
              </span>
            )}
          </div>
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
              Shout Out 💪
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
