'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { createFeedback } from '@/lib/firestore'
import { useUser } from '@/contexts/UserContext'
import { useRegion } from '@/contexts/RegionContext'
import { CHANGELOG } from '@/lib/changelog'
import { cn } from '@/lib/utils'
import type { FeedbackKind } from '@/types'

const KINDS: { value: FeedbackKind; label: string; emoji: string; placeholder: string }[] = [
  {
    value: 'bug',
    label: 'Something broke',
    emoji: '🐛',
    placeholder: "What happened, and what were you doing right before? e.g. \"Tapped +10 merkins on the 4th, count went back to 0 after I refreshed.\"",
  },
  {
    value: 'idea',
    label: 'Idea',
    emoji: '💡',
    placeholder: 'What would you want the app to do?',
  },
  {
    value: 'other',
    label: 'Other',
    emoji: '💬',
    placeholder: 'Anything else — wrong rep counts, confusing wording, praise, gripes.',
  },
]

const MAX_LENGTH = 2000

export function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { currentUser } = useUser()
  const { regionId } = useRegion()
  const pathname = usePathname()

  const [kind, setKind]         = useState<FeedbackKind>('bug')
  const [message, setMessage]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [sent, setSent]         = useState(false)
  const [error, setError]       = useState<string | null>(null)

  function reset() {
    setKind('bug')
    setMessage('')
    setSent(false)
    setError(null)
  }

  function handleClose() {
    onClose()
    // Let the close animation finish before the body swaps back.
    setTimeout(reset, 250)
  }

  async function handleSubmit() {
    const text = message.trim()
    if (!text || !currentUser) return
    setSaving(true)
    setError(null)
    try {
      await createFeedback({
        id: `${currentUser.id}_${Date.now()}`,
        regionId,
        userId: currentUser.id,
        userName: currentUser.displayName,
        kind,
        message: text.slice(0, MAX_LENGTH),
        status: 'new',
        createdAt: new Date().toISOString(),
        context: {
          path: pathname,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          standalone: typeof window !== 'undefined'
            ? window.matchMedia('(display-mode: standalone)').matches
            : undefined,
          viewport: typeof window !== 'undefined'
            ? `${window.innerWidth}x${window.innerHeight}`
            : undefined,
          // The changelog date is the closest thing the client has to a build
          // stamp, and it's the one an answer would be phrased in anyway.
          appVersion: CHANGELOG[0]?.date,
        },
      })
      setSent(true)
    } catch {
      setError("Couldn't send that — check your signal and try again.")
    } finally {
      setSaving(false)
    }
  }

  const active = KINDS.find(k => k.value === kind)!

  return (
    <Modal open={open} onClose={handleClose} title={sent ? 'Got it' : 'Send Feedback'}>
      {sent ? (
        <div className="text-center py-2">
          <div className="text-4xl mb-3">🙏</div>
          <p className="text-sm text-zinc-300 mb-1">Thanks — it landed.</p>
          <p className="text-xs text-zinc-500 mb-6">
            No reply here, but bug reports get read and fixes show up in What&apos;s New.
          </p>
          <Button variant="secondary" fullWidth onClick={handleClose}>Done</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {KINDS.map(k => (
              <button
                key={k.value}
                onClick={() => setKind(k.value)}
                className={cn(
                  'rounded-xl border px-2 py-3 text-center transition-colors',
                  kind === k.value
                    ? 'border-orange-500/60 bg-orange-500/15 text-orange-200'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                )}
              >
                <span className="block text-lg leading-none mb-1">{k.emoji}</span>
                <span className="block text-[11px] font-medium leading-tight">{k.label}</span>
              </button>
            ))}
          </div>

          <div>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value.slice(0, MAX_LENGTH))}
              placeholder={active.placeholder}
              rows={6}
              autoFocus
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
            <p className="mt-1 text-right text-[11px] text-zinc-600">
              {message.length}/{MAX_LENGTH}
            </p>
          </div>

          <p className="text-[11px] text-zinc-600">
            Sent with your F3 name, the page you&apos;re on and your device details, so a
            bug can be tracked down without a back-and-forth.
          </p>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <Button
            fullWidth
            loading={saving}
            disabled={!message.trim() || !currentUser}
            onClick={handleSubmit}
          >
            Send
          </Button>
        </div>
      )}
    </Modal>
  )
}
