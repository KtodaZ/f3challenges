'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { DailyExerciseCard } from './DailyExerciseCard'
import { formatDate } from '@/lib/utils'
import type { CompletionFraction, DailyLog, DailyTarget } from '@/types'

interface LogDayModalProps {
  open: boolean
  onClose: () => void
  target: DailyTarget
  existingLog: DailyLog | null
  onSave: (
    exerciseFractions: Record<string, CompletionFraction>,
    notes: string,
    modificationNote: string,
    isMakeUp: boolean
  ) => Promise<void>
  isMakeUp?: boolean
}

function computeOverallFraction(
  fractions: Record<string, CompletionFraction>,
  exerciseIds: string[]
): CompletionFraction {
  if (exerciseIds.length === 0) return 0
  const sum = exerciseIds.reduce((acc, id) => acc + (fractions[id] ?? 0), 0)
  const avg = sum / exerciseIds.length
  // Snap to nearest valid CompletionFraction
  if (avg >= 1)    return 1
  if (avg >= 0.75) return 0.75
  if (avg >= 0.5)  return 0.5
  if (avg >= 0.25) return 0.25
  return 0
}

export function LogDayModal({
  open,
  onClose,
  target,
  existingLog,
  onSave,
  isMakeUp = false,
}: LogDayModalProps) {
  const exerciseIds = target.exercises.map(e => e.exercise.id)

  const [fractions, setFractions] = useState<Record<string, CompletionFraction>>({})
  const [notes, setNotes] = useState('')
  const [modificationNote, setModificationNote] = useState('')
  const [saving, setSaving] = useState(false)

  // Sync state from existing log when modal opens
  useEffect(() => {
    if (!open) return
    if (existingLog) {
      const map: Record<string, CompletionFraction> = {}
      for (const el of existingLog.exerciseLogs) {
        const f = el.targetReps > 0 ? el.completedReps / el.targetReps : 0
        // Snap to valid fraction
        let snapped: CompletionFraction = 0
        if (f >= 1) snapped = 1
        else if (f >= 0.75) snapped = 0.75
        else if (f >= 0.5) snapped = 0.5
        else if (f >= 0.25) snapped = 0.25
        map[el.exerciseId] = snapped
      }
      setFractions(map)
      setNotes(existingLog.notes ?? '')
      setModificationNote(existingLog.modificationNote ?? '')
    } else {
      const map: Record<string, CompletionFraction> = {}
      for (const id of exerciseIds) map[id] = 0
      setFractions(map)
      setNotes('')
      setModificationNote('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existingLog])

  function handleFractionChange(exerciseId: string, fraction: CompletionFraction) {
    setFractions(prev => ({ ...prev, [exerciseId]: fraction }))
  }

  async function handleSave(markComplete: boolean) {
    setSaving(true)
    try {
      const finalFractions = markComplete
        ? Object.fromEntries(exerciseIds.map(id => [id, 1 as CompletionFraction]))
        : fractions
      await onSave(finalFractions, notes, modificationNote, isMakeUp)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const overallFraction = computeOverallFraction(fractions, exerciseIds)
  const pct = Math.round(overallFraction * 100)
  const allDone = overallFraction >= 1

  const title = isMakeUp
    ? `Make Up — ${formatDate(target.date)}`
    : 'Log Today'

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-3 mb-4">
        {target.exercises.map(({ exercise, reps }) => (
          <DailyExerciseCard
            key={exercise.id}
            exerciseId={exercise.id}
            name={exercise.name}
            targetReps={reps}
            fraction={fractions[exercise.id] ?? 0}
            onChange={handleFractionChange}
            disabled={saving}
          />
        ))}
      </div>

      {/* Overall progress indicator */}
      <div className="flex items-center gap-2 mb-4 p-3 bg-zinc-800 rounded-xl">
        <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-green-500' : 'bg-orange-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`text-sm font-bold shrink-0 ${allDone ? 'text-green-400' : 'text-orange-400'}`}>
          {pct}%
        </span>
      </div>

      {/* Optional fields */}
      <div className="space-y-3 mb-5">
        <Textarea
          label="Notes (optional)"
          placeholder="How'd it go? Any PRs?"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          disabled={saving}
        />
        <Textarea
          label="Modification note (optional)"
          placeholder="Modifying because…"
          value={modificationNote}
          onChange={e => setModificationNote(e.target.value)}
          rows={2}
          disabled={saving}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="secondary"
          size="lg"
          className="flex-1"
          onClick={() => handleSave(false)}
          loading={saving}
          disabled={saving}
        >
          Save Progress
        </Button>
        <Button
          variant="success"
          size="lg"
          className="flex-1"
          onClick={() => handleSave(true)}
          loading={saving}
          disabled={saving}
        >
          Mark Complete
        </Button>
      </div>
    </Modal>
  )
}
