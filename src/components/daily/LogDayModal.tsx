'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { DailyExerciseCard } from './DailyExerciseCard'
import { formatDate } from '@/lib/utils'
import type { DailyLog, DailyTarget } from '@/types'

interface LogDayModalProps {
  open: boolean
  onClose: () => void
  target: DailyTarget
  existingLog: DailyLog | null
  onSave: (
    exerciseReps: Record<string, number>,
    notes: string,
    modificationNote: string,
    isMakeUp: boolean
  ) => Promise<void>
  isMakeUp?: boolean
}

// Precise completion: reps done (capped per exercise) over reps targeted —
// a true "% of reps done" that's exact at 1 only when every exercise is in.
function computeOverallFraction(
  repsMap: Record<string, number>,
  exercises: DailyTarget['exercises']
): number {
  let done = 0
  let target = 0
  for (const { exercise, reps } of exercises) {
    if (reps <= 0) continue
    done += Math.min(repsMap[exercise.id] ?? 0, reps)
    target += reps
  }
  return target > 0 ? done / target : 0
}

export function LogDayModal({
  open,
  onClose,
  target,
  existingLog,
  onSave,
  isMakeUp = false,
}: LogDayModalProps) {
  const [repsMap, setRepsMap] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState('')
  const [modificationNote, setModificationNote] = useState('')
  const [saving, setSaving] = useState(false)

  // Sync state from existing log when modal opens
  useEffect(() => {
    if (!open) return
    if (existingLog) {
      const map: Record<string, number> = {}
      for (const el of existingLog.exerciseLogs) {
        map[el.exerciseId] = el.completedReps
      }
      setRepsMap(map)
      setNotes(existingLog.notes ?? '')
      setModificationNote(existingLog.modificationNote ?? '')
    } else {
      const map: Record<string, number> = {}
      for (const { exercise } of target.exercises) map[exercise.id] = 0
      setRepsMap(map)
      setNotes('')
      setModificationNote('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existingLog])

  function handleRepsChange(exerciseId: string, reps: number) {
    setRepsMap(prev => ({ ...prev, [exerciseId]: reps }))
  }

  async function handleSave(markComplete: boolean) {
    setSaving(true)
    try {
      const finalReps = markComplete
        ? Object.fromEntries(target.exercises.map(({ exercise, reps }) => [exercise.id, reps]))
        : repsMap
      await onSave(finalReps, notes, modificationNote, isMakeUp)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const overallFraction = computeOverallFraction(repsMap, target.exercises)
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
            completedReps={repsMap[exercise.id] ?? 0}
            onChange={handleRepsChange}
            disabled={saving}
            unit={exercise.unit}
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
