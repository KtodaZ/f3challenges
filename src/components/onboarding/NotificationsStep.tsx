'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'
import { cn } from '@/lib/utils'
import { COMPETITIVE_DISCLAIMER, COMPETITIVE_EXAMPLE } from '@/components/notifications/CompetitiveOptIn'
import type { NotificationPreferences } from '@/types'
import { DEFAULT_NOTIFICATION_PREFS } from '@/types'

interface Props {
  onNext: (prefs: NotificationPreferences) => void
  existingPrefs?: NotificationPreferences
}

interface WindowRow {
  key: keyof Pick<NotificationPreferences, 'morning' | 'afternoon' | 'evening' | 'weeklyRecap'>
  label: string
  description: string
}

const WINDOWS: WindowRow[] = [
  { key: 'morning',     label: 'Morning reminder',   description: 'Start the day with a push' },
  { key: 'afternoon',   label: 'Afternoon check-in', description: 'Midday nudge if you haven\'t logged' },
  { key: 'evening',     label: 'Evening reminder',   description: 'Last chance — don\'t break the streak' },
  { key: 'weeklyRecap', label: 'Weekly recap',        description: 'Sunday summary of the week' },
]

export function NotificationsStep({ onNext, existingPrefs }: Props) {
  const [prefs, setPrefs] = useState<NotificationPreferences>(existingPrefs ?? DEFAULT_NOTIFICATION_PREFS)

  function toggleWindow(key: WindowRow['key']) {
    setPrefs(prev => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled },
    }))
  }

  function setTime(key: WindowRow['key'], time: string) {
    setPrefs(prev => ({
      ...prev,
      [key]: { ...prev[key], time },
    }))
  }

  return (
    <div className="flex flex-col min-h-full px-6 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Notification times</h2>
        <p className="text-zinc-400 text-sm">All times are Pacific Time. Customize or disable each one.</p>
      </div>

      <div className="space-y-3 flex-1">
        {WINDOWS.map(({ key, label, description }) => {
          const pref = prefs[key] as { enabled: boolean; time: string }
          return (
            <div
              key={key}
              className={cn(
                'bg-zinc-900 border rounded-2xl p-4 transition-colors',
                pref.enabled ? 'border-zinc-700' : 'border-zinc-800 opacity-60'
              )}
            >
              <Switch
                checked={pref.enabled}
                onCheckedChange={() => toggleWindow(key)}
                label={label}
                description={description}
              />
              {pref.enabled && (
                <div className="mt-3 flex items-center gap-2">
                  <label className="text-xs text-zinc-500 shrink-0">Time</label>
                  <input
                    type="time"
                    value={pref.time}
                    onChange={e => setTime(key, e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
              )}
            </div>
          )
        })}

        {/* Mentions toggle */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4">
          <Switch
            checked={prefs.mentions}
            onCheckedChange={v => setPrefs(prev => ({ ...prev, mentions: v }))}
            label="@Mention notifications"
            description="Get notified when someone shouts you out"
          />
        </div>

        {/* Competitive nudges — opt-in */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4 space-y-3">
          <Switch
            checked={prefs.competitive ?? false}
            onCheckedChange={v => setPrefs(prev => ({ ...prev, competitive: v }))}
            label="🏁 Competitive nudges"
            description={COMPETITIVE_EXAMPLE}
          />
          <p className="text-xs text-zinc-500 leading-relaxed border-t border-zinc-800 pt-3">
            {COMPETITIVE_DISCLAIMER}
          </p>
        </div>
      </div>

      <div className="mt-8">
        <Button onClick={() => onNext({ ...prefs, competitivePrompted: true })} size="lg" fullWidth>
          Continue →
        </Button>
      </div>
    </div>
  )
}
