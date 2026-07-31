'use client'

import { useState, useEffect, useRef } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { MentionAutocomplete } from '@/components/feed/MentionAutocomplete'
import { createFeedPost } from '@/lib/firestore'
import { useRegion } from '@/contexts/RegionContext'
import { generateId, extractHashtags, extractMentionNames } from '@/lib/utils'
import type { User, FeedPost } from '@/types'

/** Where a PAX stands on today's challenge — used to group the callout list. */
export type CalloutUserStatus = 'notStarted' | 'started' | 'done'

const STATUS_ORDER: CalloutUserStatus[] = ['notStarted', 'started', 'done']
const STATUS_LABELS: Record<CalloutUserStatus, string> = {
  notStarted: "Haven't started",
  started: 'In progress',
  done: 'Finished today',
}

interface CalloutModalProps {
  open: boolean
  onClose: () => void
  currentUser: User
  /** Users who can be called out / @-mentioned — filter to current-challenge
   *  participants at the call site so drop-off PAX don't appear. */
  users: User[]
  /** Today's status per user id. When provided, the picker groups PAX by
   *  progress (haven't started / in progress / finished). Missing = flat list. */
  statusByUserId?: Map<string, CalloutUserStatus>
  challengeId: string
  /** Pre-select a target user when the modal opens. */
  defaultTarget?: User | null
  /** Pre-fill the message content when the modal opens. */
  defaultContent?: string
  /** Called after a post is successfully created, with the target user id if any. */
  onPosted?: (targetUserId: string | null) => void
}

// {region} is replaced with the PAX's own region name at render time.
const CREW_PLACEHOLDERS = [
  'Great work out there, PAX!',
  'The crew showed up today!',
  '{region} putting in the work!',
  'Whole PAX grinding — let\'s go!',
  'Proud of this crew today.',
  'Nobody left behind out there!',
  'That\'s what {region} is about!',
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
  statusByUserId,
  challengeId,
  defaultTarget,
  defaultContent,
  onPosted,
}: CalloutModalProps) {
  // Ids of the PAX being called out. Empty = a general shoutout (feed post, no
  // pings); one = a direct callout; everyone = "the whole crew" rally.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(defaultTarget ? [defaultTarget.id] : [])
  )
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [placeholderIdx, setPlaceholderIdx] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { region } = useRegion()

  // Sync selection and content when the modal opens; pick a fresh placeholder each time
  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(defaultTarget ? [defaultTarget.id] : []))
      setContent(defaultContent ?? '')
      setPlaceholderIdx(Math.floor(Math.random() * CREW_PLACEHOLDERS.length))
    }
  }, [open, defaultTarget, defaultContent])

  const otherUsers = users.filter(u => u.id !== currentUser.id)

  const allSelected = otherUsers.length > 0 && otherUsers.every(u => selectedIds.has(u.id))
  // When exactly one PAX is picked we keep the classic single-callout behavior
  // (targetUserId → guaranteed ping + "shouted out @X" in the feed).
  const singleTarget = selectedIds.size === 1
    ? otherUsers.find(u => selectedIds.has(u.id)) ?? null
    : null

  function toggleUser(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleWholeCrew() {
    setSelectedIds(allSelected ? new Set() : new Set(otherUsers.map(u => u.id)))
  }

  function toggleGroup(group: User[], allInGroupSelected: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      for (const u of group) {
        if (allInGroupSelected) next.delete(u.id)
        else next.add(u.id)
      }
      return next
    })
  }

  // Group the pickable PAX by today's progress. Only when the caller supplies
  // statuses — otherwise fall back to one flat list.
  const groupedUsers = statusByUserId
    ? STATUS_ORDER
        .map(status => ({
          status,
          members: otherUsers.filter(
            u => (statusByUserId.get(u.id) ?? 'notStarted') === status
          ),
        }))
        .filter(g => g.members.length > 0)
    : null

  const renderChip = (u: User) => (
    <button
      key={u.id}
      onClick={() => toggleUser(u.id)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
        selectedIds.has(u.id)
          ? 'bg-orange-500 text-white'
          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
      }`}
    >
      <Avatar name={u.displayName} size="xs" />
      {u.displayName}
    </button>
  )

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
      // Resolve @mention names → user IDs (additive to the selected PAX)
      const mentionedNames = extractMentionNames(content, users)
      const mentionedUsers = users.filter(u =>
        mentionedNames.some(name => name.toLowerCase() === u.displayName.toLowerCase())
      )
      const mentionIds = mentionedUsers.map(u => u.id)
      // Everyone selected (or typed) gets tagged — the Cloud Function notifies
      // each one who has mentions enabled. A single pick also becomes the
      // targetUserId so the feed reads "shouted out @X" and they always ping.
      const allMentions = [...new Set([...selectedIds, ...mentionIds])]

      const post: FeedPost = {
        id: generateId(),
        type: 'shoutout',
        authorId: currentUser.id,
        content: content.trim(),
        hashtags: extractHashtags(content),
        mentions: allMentions,
        challengeId,
        ...(singleTarget ? { targetUserId: singleTarget.id } : {}),
        createdAt: new Date().toISOString(),
        deleted: false,
      }
      await createFeedPost(post)
      onPosted?.(singleTarget?.id ?? null)
      setDone(true)
      setTimeout(() => {
        setDone(false)
        setSelectedIds(new Set())
        setContent('')
        onClose()
      }, 1200)
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    if (saving) return
    setSelectedIds(new Set())
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
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-zinc-300">Who are you calling out?</p>
              {selectedIds.size > 0 && (
                <span className="text-xs text-zinc-500">
                  {allSelected
                    ? `Whole crew · ${selectedIds.size}`
                    : `${selectedIds.size} selected`}
                </span>
              )}
            </div>
            <button
              onClick={toggleWholeCrew}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors mb-3 ${
                allSelected
                  ? 'bg-orange-500 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {allSelected ? 'Clear crew' : 'The whole crew'}
            </button>

            {groupedUsers ? (
              <div className="space-y-3">
                {groupedUsers.map(({ status, members }) => {
                  const allInGroup = members.every(u => selectedIds.has(u.id))
                  return (
                    <div key={status}>
                      <button
                        onClick={() => toggleGroup(members, allInGroup)}
                        className="flex items-center gap-2 mb-1.5 group"
                      >
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          {STATUS_LABELS[status]}
                        </span>
                        <span className="text-xs text-zinc-600">{members.length}</span>
                        <span className="text-[11px] font-medium text-orange-400/70 group-hover:text-orange-400 transition-colors">
                          {allInGroup ? 'Clear' : 'Select all'}
                        </span>
                      </button>
                      <div className="flex gap-2 flex-wrap">
                        {members.map(renderChip)}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {otherUsers.map(renderChip)}
              </div>
            )}
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
                  singleTarget
                    ? TARGET_PLACEHOLDERS[placeholderIdx % TARGET_PLACEHOLDERS.length](singleTarget.displayName)
                    : CREW_PLACEHOLDERS[placeholderIdx].replace('{region}', region.name)
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
