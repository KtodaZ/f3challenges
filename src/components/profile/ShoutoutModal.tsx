'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { createFeedPost } from '@/lib/firestore'
import { generateId } from '@/lib/utils'
import { useUser } from '@/contexts/UserContext'
import type { User } from '@/types'

const PLACEHOLDERS = [
  (name: string) => `${name} is crushing it because…`,
  (name: string) => `Big ups to ${name}…`,
  (name: string) => `${name} put in the work…`,
  (name: string) => `Props to ${name} for…`,
  (name: string) => `${name} showed up today…`,
  (name: string) => `Shout out ${name} for…`,
  (name: string) => `${name} crushed it today…`,
]

interface ShoutoutModalProps {
  open: boolean
  onClose: () => void
  targetUser: User
  challengeId?: string
}

export function ShoutoutModal({ open, onClose, targetUser, challengeId }: ShoutoutModalProps) {
  const { currentUser } = useUser()
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [placeholderIdx, setPlaceholderIdx] = useState(0)

  useEffect(() => {
    if (open) setPlaceholderIdx(Math.floor(Math.random() * PLACEHOLDERS.length))
  }, [open])

  async function handleSubmit() {
    if (!currentUser) return
    if (!content.trim()) {
      setError('Write something nice!')
      return
    }
    setError('')
    setSaving(true)
    try {
      const now = new Date().toISOString()
      await createFeedPost({
        id: generateId(),
        type: 'shoutout',
        authorId: currentUser.id,
        authorName: currentUser.displayName,
        content: content.trim(),
        hashtags: [],
        mentions: [targetUser.id],
        targetUserId: targetUser.id,
        ...(challengeId ? { challengeId } : {}),
        createdAt: now,
        deleted: false,
      })
      setContent('')
      onClose()
    } catch {
      setError('Failed to post shoutout. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Shout out ${targetUser.displayName}`}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-zinc-800 rounded-xl">
          <span className="text-2xl">📣</span>
          <div>
            <p className="text-sm font-semibold text-white">{targetUser.displayName}</p>
            <p className="text-xs text-zinc-500">This shoutout will appear in the feed</p>
          </div>
        </div>

        {!targetUser.fcmTokens?.length && (
          <div className="flex items-start gap-2.5 p-3 bg-amber-900/20 border border-amber-700/40 rounded-xl">
            <span className="text-base leading-none mt-0.5">🔕</span>
            <p className="text-xs text-amber-300">
              {targetUser.displayName} hasn&apos;t set up push notifications — they may not see this shoutout right away.
            </p>
          </div>
        )}

        <Textarea
          label="Your message"
          placeholder={PLACEHOLDERS[placeholderIdx](targetUser.displayName)}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          error={error && !content.trim() ? error : undefined}
        />

        {error && content.trim() && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="ghost" fullWidth onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="success"
            fullWidth
            loading={saving}
            onClick={handleSubmit}
          >
            Post Shoutout 📣
          </Button>
        </div>
      </div>
    </Modal>
  )
}
