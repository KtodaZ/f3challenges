'use client'

import { useState, useEffect, useRef } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { MentionAutocomplete } from '@/components/feed/MentionAutocomplete'
import { createFeedPost } from '@/lib/firestore'
import { generateId, extractHashtags, extractMentionNames } from '@/lib/utils'
import type { User, FeedPost } from '@/types'

interface CalloutModalProps {
  open: boolean
  onClose: () => void
  currentUser: User
  /** Users who can be called out / @-mentioned — filter to current-challenge
   *  participants at the call site so drop-off PAX don't appear. */
  users: User[]
  challengeId: string
  /** Pre-select a target user when the modal opens. */
  defaultTarget?: User | null
  /** Pre-fill the message content when the modal opens. */
  defaultContent?: string
  /** Called after a post is successfully created, with the target user id if any. */
  onPosted?: (targetUserId: string | null) => void
}

const CREW_PLACEHOLDERS = [
  'Great work out there, PAX!',
  'The crew showed up today!',
  'F3 Bedrock putting in the work!',
  'Whole PAX grinding — let\'s go!',
  'Proud of this crew today.',
  'Nobody left behind out there!',
  'That\'s what F3 Bedrock is about!',
]

const TARGET_PLACEHOLDERS = [
  (name: string) => `Shout out ${name}…`,
  (name: string) => `Big ups to ${name}…`,
  (name: string) => `${name} crushed it today…`,
  (name: string) => `Props to ${name}…`,
  (name: string) => `${name} put in the work…`,
  (name: string) => `Call out ${name} for…`,
  (name: string) => `${name} showed up today…`,
]

export function CalloutModal({
  open,
  onClose,
  currentUser,
  users,
  challengeId,
  defaultTarget,
  defaultContent,
  onPosted,
}: CalloutModalProps) {
  const [targetUser, setTargetUser] = useState<User | null>(defaultTarget ?? null)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [placeholderIdx, setPlaceholderIdx] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync target and content when the modal opens; pick a fresh placeholder each time
  useEffect(() => {
    if (open) {
      setTargetUser(defaultTarget ?? null)
      setContent(defaultContent ?? '')
      setPlaceholderIdx(Math.floor(Math.random() * CREW_PLACEHOLDERS.length))
    }
  }, [open, defaultTarget, defaultContent])

  const otherUsers = users.filter(u => u.id !== currentUser.id)

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value)
    const cursor = e.target.selectionStart ?? e.target.value.length
    const textBeforeCursor = e.target.value.slice(0, cursor)
    const atMatch = textBeforeCursor.match(/@([\w ]*)$/)
    setMentionQuery(atMatch ? atMatch[1] : null)
  }

  function handleMentionSelect(user: User) {
    if (!textareaRef.current) return
    const cursor = textareaRef.current.selectionStart ?? content.length
    const textBeforeCursor = content.slice(0, cursor)
    const textAfterCursor = content.slice(cursor)
    const replaced = textBeforeCursor.replace(/@([\w ]*)$/, `@${user.displayName} `)
    setContent(replaced + textAfterCursor)
    setMentionQuery(null)
    textareaRef.current.focus()
  }

  async function handlePost() {
    if (!content.trim()) return
    setSaving(true)
    try {
      // Resolve @mention names → user IDs (additive to targetUser)
      const mentionedNames = extractMentionNames(content, users)
      const mentionedUsers = users.filter(u =>
        mentionedNames.some(name => name.toLowerCase() === u.displayName.toLowerCase())
      )
      const mentionIds = mentionedUsers.map(u => u.id)
      const allMentions = targetUser
        ? [...new Set([targetUser.id, ...mentionIds])]
        : mentionIds

      const post: FeedPost = {
        id: generateId(),
        type: 'shoutout',
        authorId: currentUser.id,
        content: content.trim(),
        hashtags: extractHashtags(content),
        mentions: allMentions,
        challengeId,
        ...(targetUser ? { targetUserId: targetUser.id } : {}),
        createdAt: new Date().toISOString(),
        deleted: false,
      }
      await createFeedPost(post)
      onPosted?.(targetUser?.id ?? null)
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
    setMentionQuery(null)
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

          <div>
            <p className="text-sm font-medium text-zinc-300 mb-1.5">Message</p>
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
                placeholder={
                  targetUser
                    ? TARGET_PLACEHOLDERS[placeholderIdx % TARGET_PLACEHOLDERS.length](targetUser.displayName)
                    : CREW_PLACEHOLDERS[placeholderIdx]
                }
                rows={3}
                disabled={saving}
                className="bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 rounded-xl px-4 py-3 text-sm w-full resize-none focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {mentionQuery !== null && (
                <MentionAutocomplete
                  query={mentionQuery}
                  users={otherUsers}
                  onSelect={handleMentionSelect}
                />
              )}
            </div>
          </div>

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
