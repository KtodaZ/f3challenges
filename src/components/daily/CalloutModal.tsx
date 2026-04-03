'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { createFeedPost } from '@/lib/firestore'
import { generateId } from '@/lib/utils'
import type { User, FeedPost } from '@/types'

interface CalloutModalProps {
  open: boolean
  onClose: () => void
  currentUser: User
  allUsers: User[]
  challengeId: string
  /** Pre-select a target user when the modal opens. */
  defaultTarget?: User | null
}

export function CalloutModal({
  open,
  onClose,
  currentUser,
  allUsers,
  challengeId,
  defaultTarget,
}: CalloutModalProps) {
  const [targetUser, setTargetUser] = useState<User | null>(defaultTarget ?? null)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  // Sync target when the modal opens with a new defaultTarget
  useEffect(() => {
    if (open) {
      setTargetUser(defaultTarget ?? null)
    }
  }, [open, defaultTarget])

  const otherUsers = allUsers.filter(u => u.id !== currentUser.id)

  async function handlePost() {
    if (!content.trim()) return
    setSaving(true)
    try {
      const post: FeedPost = {
        id: generateId(),
        type: 'shoutout',
        authorId: currentUser.id,
        content: content.trim(),
        hashtags: [],
        mentions: targetUser ? [targetUser.id] : [],
        challengeId,
        ...(targetUser ? { targetUserId: targetUser.id } : {}),
        createdAt: new Date().toISOString(),
        deleted: false,
      }
      await createFeedPost(post)
      setDone(true)
      setTimeout(() => {
        setDone(false)
        setTargetUser(null)
        setContent('')
        onClose()
      }, 1200)
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    if (saving) return
    setTargetUser(null)
    setContent('')
    setDone(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Call Out a PAX">
      {done ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-white font-semibold">Shoutout posted!</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-zinc-300 mb-2">Who are you calling out?</p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setTargetUser(null)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                  targetUser === null
                    ? 'bg-orange-500 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                The whole crew
              </button>
              {otherUsers.map(u => (
                <button
                  key={u.id}
                  onClick={() => setTargetUser(u)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                    targetUser?.id === u.id
                      ? 'bg-orange-500 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  <Avatar name={u.displayName} size="xs" />
                  {u.displayName}
                </button>
              ))}
            </div>
          </div>

          <Textarea
            label="Message"
            placeholder={
              targetUser
                ? `Shout out ${targetUser.displayName}…`
                : 'Great work out there, PAX!'
            }
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={3}
            disabled={saving}
          />

          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handlePost}
            loading={saving}
            disabled={!content.trim() || saving}
          >
            Post Shoutout
          </Button>
        </div>
      )}
    </Modal>
  )
}
