'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { CHALLENGES, getTotalDays, getMonthlyTotal, getTodayPT } from '@/lib/challenges'
import { updateUser } from '@/lib/firestore'
import { setCachedUser } from '@/lib/storage'
import { useUser } from '@/contexts/UserContext'
import type { AchievementBadge } from '@/types'

type Selection = 'completed' | 'participant' | 'skipped'

const HISTORICAL = CHALLENGES.filter(c => c.endDate < getTodayPT())

function selectionsFromBadges(badges: AchievementBadge[] = []): Record<string, Selection> {
  const byId = Object.fromEntries(badges.map(b => [b.challengeId, b.type as Selection]))
  return Object.fromEntries(HISTORICAL.map(c => [c.id, byId[c.id] ?? 'skipped']))
}

function badgesToSelections(selections: Record<string, Selection>): AchievementBadge[] {
  return HISTORICAL
    .filter(c => selections[c.id] !== 'skipped')
    .map(c => ({
      challengeId: c.id,
      type: selections[c.id] as 'completed' | 'participant',
      awardedAt: new Date().toISOString(),
    }))
}

export function PastChallengesSettings() {
  const { currentUser, refreshCurrentUser } = useUser()
  const [selections, setSelections] = useState<Record<string, Selection>>(
    () => selectionsFromBadges(currentUser?.badges)
  )
  const [saving, setSaving] = useState(false)

  function select(challengeId: string, val: Selection) {
    setSelections(prev => ({ ...prev, [challengeId]: val }))
  }

  async function handleSave() {
    if (!currentUser) return
    setSaving(true)
    try {
      const badges = badgesToSelections(selections)
      await updateUser(currentUser.id, { badges })
      setCachedUser({ ...currentUser, badges })
      await refreshCurrentUser()
      toast.success('Badges updated')
    } catch {
      toast.error('Failed to save — try again')
    } finally {
      setSaving(false)
    }
  }

  if (HISTORICAL.length === 0) {
    return (
      <p className="text-sm text-zinc-500 text-center py-8">No past challenges to show.</p>
    )
  }

  return (
    <div className="space-y-4">
      {HISTORICAL.map(challenge => {
        const days  = getTotalDays(challenge)
        const total = getMonthlyTotal(challenge)
        const sel   = selections[challenge.id]

        return (
          <div key={challenge.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="mb-3">
              <p className="font-semibold text-white">{challenge.name}</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {new Date(challenge.startDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                {' · '}{days} days · {total.toLocaleString()} total reps
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                {challenge.exercises.map(e => e.name).join(', ')}
              </p>
            </div>

            <div className="flex gap-2">
              {(['completed', 'participant', 'skipped'] as Selection[]).map(opt => (
                <button
                  key={opt}
                  onClick={() => select(challenge.id, opt)}
                  className={cn(
                    'flex-1 py-2 px-2 rounded-xl text-xs font-medium transition-colors border',
                    sel === opt
                      ? opt === 'completed'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                        : opt === 'participant'
                          ? 'bg-zinc-600/40 border-zinc-500 text-zinc-200'
                          : 'bg-zinc-800 border-zinc-600 text-zinc-400'
                      : 'bg-transparent border-zinc-800 text-zinc-500 hover:border-zinc-700'
                  )}
                >
                  {opt === 'completed' ? '🏆 Completed'
                    : opt === 'participant' ? '🥈 Participated'
                    : 'Skipped'}
                </button>
              ))}
            </div>
          </div>
        )
      })}

      <Button onClick={handleSave} disabled={saving} size="lg" fullWidth>
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </div>
  )
}
