'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { upsertParticipation, participationId } from '@/lib/firestore'
import { stripUndefined } from '@/lib/utils'
import type { ChallengeParticipation } from '@/types'

interface OptOutModalProps {
  open: boolean
  onClose: () => void
  userId: string
  challengeId: string
  currentParticipation: ChallengeParticipation | null
  onSuccess: (updated: ChallengeParticipation) => void
}

type Mode = 'opt-out' | 'modifying'

export function OptOutModal({
  open,
  onClose,
  userId,
  challengeId,
  currentParticipation,
  onSuccess,
}: OptOutModalProps) {
  const [mode, setMode] = useState<Mode>('opt-out')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (mode === 'opt-out' && !reason.trim()) {
      setError('Please provide a reason for opting out.')
      return
    }
    if (mode === 'modifying' && !note.trim()) {
      setError('Please describe what you are modifying.')
      return
    }
    setError('')
    setSaving(true)

    try {
      const now = new Date().toISOString()
      const stripped = stripUndefined<ChallengeParticipation>({
        id: participationId(userId, challengeId),
        userId,
        challengeId,
        status: mode === 'opt-out' ? 'opted-out' : 'modifying',
        optOutReason: mode === 'opt-out' ? reason.trim() : currentParticipation?.optOutReason,
        modificationNote: mode === 'modifying' ? note.trim() : undefined,
        joinedAt: currentParticipation?.joinedAt ?? now,
        updatedAt: now,
      })
      await upsertParticipation(stripped)
      onSuccess(stripped)
      onClose()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Update Status">
      <div className="space-y-4">
        {/* Mode selector */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode('opt-out')}
            className={`
              rounded-xl px-3 py-2.5 text-sm font-medium border transition-colors text-left
              ${mode === 'opt-out'
                ? 'bg-red-900/30 border-red-700/60 text-red-300'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
              }
            `}
          >
            <div className="text-base mb-0.5">🚫</div>
            Opt Out
          </button>
          <button
            onClick={() => setMode('modifying')}
            className={`
              rounded-xl px-3 py-2.5 text-sm font-medium border transition-colors text-left
              ${mode === 'modifying'
                ? 'bg-orange-900/30 border-orange-700/60 text-orange-300'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
              }
            `}
          >
            <div className="text-base mb-0.5">✏️</div>
            Modifying
          </button>
        </div>

        {/* Description */}
        <p className="text-sm text-zinc-400">
          {mode === 'opt-out'
            ? 'Opting out removes you from the active challenge. You can rejoin at any time.'
            : 'Mark yourself as modifying if you are doing a scaled or alternative version of the challenge.'
          }
        </p>

        {/* Reason / Note input */}
        {mode === 'opt-out' ? (
          <Textarea
            label="Reason for opting out *"
            placeholder="Injury, travel, life happens..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            error={error && !reason.trim() ? error : undefined}
          />
        ) : (
          <Textarea
            label="What are you modifying? *"
            placeholder="Scaling reps due to shoulder injury..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            error={error && !note.trim() ? error : undefined}
          />
        )}

        {error && ((mode === 'opt-out' && reason.trim()) || (mode === 'modifying' && note.trim())) && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="ghost" fullWidth onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant={mode === 'opt-out' ? 'danger' : 'primary'}
            fullWidth
            loading={saving}
            onClick={handleSubmit}
          >
            {mode === 'opt-out' ? 'Opt Out' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
