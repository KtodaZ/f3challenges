'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/Switch'
import { useUser } from '@/contexts/UserContext'
import { updateUser } from '@/lib/firestore'
import { setCachedUser } from '@/lib/storage'
import type { NotificationPreferences } from '@/types'
import { DEFAULT_NOTIFICATION_PREFS } from '@/types'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const TIME_INPUT_CLASS =
  'bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500'

interface TimeRowProps {
  label: string
  description: string
  enabled: boolean
  time: string
  onToggle: (v: boolean) => void
  onTimeChange: (v: string) => void
  extra?: React.ReactNode
}

function TimeRow({ label, description, enabled, time, onToggle, onTimeChange, extra }: TimeRowProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{description}</p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          id={`switch-${label.toLowerCase().replace(/\s+/g, '-')}`}
        />
      </div>
      {enabled && (
        <div className="flex items-center gap-3 pt-1">
          <label className="text-xs text-zinc-500 shrink-0">Time</label>
          <input
            type="time"
            value={time}
            onChange={e => onTimeChange(e.target.value)}
            className={TIME_INPUT_CLASS}
          />
          {extra}
        </div>
      )}
    </div>
  )
}

export function NotificationSettings() {
  const { currentUser } = useUser()

  const initial: NotificationPreferences =
    currentUser?.notificationPreferences ?? DEFAULT_NOTIFICATION_PREFS

  const [prefs, setPrefs] = useState<NotificationPreferences>(initial)
  const [saving, setSaving] = useState(false)

  function setWindow<K extends 'morning' | 'afternoon' | 'evening'>(
    key: K,
    patch: Partial<NotificationPreferences[K]>
  ) {
    setPrefs(p => ({ ...p, [key]: { ...p[key], ...patch } }))
  }

  function setWeeklyRecap(patch: Partial<NotificationPreferences['weeklyRecap']>) {
    setPrefs(p => ({ ...p, weeklyRecap: { ...p.weeklyRecap, ...patch } }))
  }

  async function handleSave() {
    if (!currentUser) return
    setSaving(true)
    try {
      await updateUser(currentUser.id, { notificationPreferences: prefs })
      const updatedUser = { ...currentUser, notificationPreferences: prefs }
      setCachedUser(updatedUser)
      toast.success('Notification preferences saved')
    } catch {
      toast.error('Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <TimeRow
        label="Morning Reminder"
        description="Your daily challenge reminder. We'll send you an AI-generated message to kick off the day — with how many PAX have already completed today's workout."
        enabled={prefs.morning.enabled}
        time={prefs.morning.time}
        onToggle={v => setWindow('morning', { enabled: v })}
        onTimeChange={v => setWindow('morning', { time: v })}
      />

      <TimeRow
        label="Afternoon Check-in"
        description="A midday nudge if you haven't logged yet. Includes group progress so you can see where the crew stands."
        enabled={prefs.afternoon.enabled}
        time={prefs.afternoon.time}
        onToggle={v => setWindow('afternoon', { enabled: v })}
        onTimeChange={v => setWindow('afternoon', { time: v })}
      />

      <TimeRow
        label="Evening Reminder"
        description="Last chance reminder before midnight. Gets more urgent as the month goes on — don't break the streak."
        enabled={prefs.evening.enabled}
        time={prefs.evening.time}
        onToggle={v => setWindow('evening', { enabled: v })}
        onTimeChange={v => setWindow('evening', { time: v })}
      />

      <TimeRow
        label="Weekly Recap"
        description="A Sunday summary of your week: days completed, total reps, and how you stack up against the crew."
        enabled={prefs.weeklyRecap.enabled}
        time={prefs.weeklyRecap.time}
        onToggle={v => setWeeklyRecap({ enabled: v })}
        onTimeChange={v => setWeeklyRecap({ time: v })}
        extra={
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-500 shrink-0">Day</label>
            <select
              value={prefs.weeklyRecap.dayOfWeek}
              onChange={e => setWeeklyRecap({ dayOfWeek: Number(e.target.value) })}
              className={TIME_INPUT_CLASS}
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
          </div>
        }
      />

      {/* Mentions — toggle only */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">@Mention Notifications</p>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Get notified when someone shouts you out or @mentions you in a post. Instant delivery.
            </p>
          </div>
          <Switch
            checked={prefs.mentions}
            onCheckedChange={v => setPrefs(p => ({ ...p, mentions: v }))}
            id="switch-mentions"
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 transition-colors"
      >
        {saving ? 'Saving…' : 'Save Preferences'}
      </button>

      <Link
        href="/settings/notifications/troubleshoot"
        className="flex items-center justify-between w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
      >
        <span>Not receiving notifications?</span>
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  )
}
