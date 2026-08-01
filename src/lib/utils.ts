import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Participation lives in shared/src/participation.ts — the notification Cloud
// Function needs the identical rule, and two copies drift. Re-exported here so
// existing `from '@/lib/utils'` imports keep working.
export { PARTICIPANT_GRACE_DAYS, isChallengeParticipant } from '@f3-bedrock/shared'

/** Strip undefined values from an object before passing to Firestore setDoc/updateDoc. */
export function stripUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T
}

/** Format YYYY-MM-DD to "Mon Apr 1" */
export function formatDate(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** Calendar day (YYYY-MM-DD) of an ISO timestamp in Pacific time — the key we
 *  group feed posts by so day separators line up with the region's timezone. */
export function pacificDayKey(iso: string): string {
  // en-CA gives YYYY-MM-DD; timeZone shifts to America/Los_Angeles.
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
}

/** Human label for a Pacific day key: "Today", "Yesterday", or "Wed, Apr 15". */
export function formatDaySeparator(dayKey: string): string {
  const todayKey = pacificDayKey(new Date().toISOString())
  if (dayKey === todayKey) return 'Today'

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (dayKey === pacificDayKey(yesterday.toISOString())) return 'Yesterday'

  // Anchor at noon so the label's own formatting can't cross a day boundary.
  return new Date(dayKey + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** Format a duration in seconds as m:ss (e.g. 180 → "3:00"). */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const mins = Math.floor(s / 60)
  const secs = s % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/** Format ISO timestamp to "2h ago", "just now", etc. */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)   return `${days}d ago`
  return formatDate(new Date(iso).toLocaleDateString('en-CA'))
}

/** Generate a random nanoid-style ID (no dependency). */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/** Extract hashtags from text → ['workout', 'merkin'] */
export function extractHashtags(text: string): string[] {
  return [...text.matchAll(/#(\w+)/g)].map(m => m[1].toLowerCase())
}

/** Extract @mentions from text → user display names (need to resolve to IDs separately). */
export function extractMentionNames(
  text: string,
  users?: { displayName: string }[]
): string[] {
  if (users && users.length > 0) {
    const sorted = [...users].sort((a, b) => b.displayName.length - a.displayName.length)
    const namePattern = sorted
      .map(u => u.displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')
    return [...text.matchAll(new RegExp(`@(${namePattern})`, 'gi'))].map(m => {
      const lower = m[1].toLowerCase()
      return users.find(u => u.displayName.toLowerCase() === lower)?.displayName ?? m[1]
    })
  }
  return [...text.matchAll(/@(\w+)/g)].map(m => m[1])
}

/** Render post content with highlighted @mentions and #hashtags (returns plain string for now). */
export function highlightMentions(
  content: string,
  users?: { id: string; displayName: string }[]
): string {
  let result = content

  if (users && users.length > 0) {
    const sorted = [...users].sort((a, b) => b.displayName.length - a.displayName.length)
    const namePattern = sorted
      .map(u => u.displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')
    result = result.replace(
      new RegExp(`@(${namePattern})`, 'gi'),
      (_, name: string) => {
        const user = sorted.find(u => u.displayName.toLowerCase() === name.toLowerCase())
        if (user) {
          return `<a href="/profile/${user.id}" class="text-orange-400 font-semibold hover:underline">@${name}</a>`
        }
        return `<span class="text-orange-400 font-semibold">@${name}</span>`
      }
    )
  } else {
    result = result.replace(/@(\w+)/g, '<span class="text-orange-400 font-semibold">@$1</span>')
  }

  return result.replace(/#(\w+)/g, '<span class="text-green-400">#$1</span>')
}

/** Streak from sorted array of YYYY-MM-DD log dates (most recent last).
 *  Rest dates are skipped — a gap is bridged only if every day in it is a rest day. */
export function calculateStreak(sortedDates: string[], restDates: string[] = []): { current: number; longest: number } {
  if (!sortedDates.length) return { current: 0, longest: 0 }

  const restSet = new Set(restDates)
  const logSet  = new Set(sortedDates)

  function nextDay(date: string): string {
    const d = new Date(date + 'T00:00:00')
    d.setDate(d.getDate() + 1)
    return d.toLocaleDateString('en-CA')
  }

  // True only when every calendar day strictly between a and b is a rest day.
  function allGapDaysAreRest(a: string, b: string): boolean {
    let d = nextDay(a)
    while (d < b) {
      if (!restSet.has(d)) return false
      d = nextDay(d)
    }
    return true
  }

  let longest = 1
  let run = 1

  for (let i = 1; i < sortedDates.length; i++) {
    if (allGapDaysAreRest(sortedDates[i - 1], sortedDates[i])) {
      run++
      if (run > longest) longest = run
    } else {
      run = 1
    }
  }

  // Streak is alive if every non-rest day between the last log (exclusive) and today
  // (exclusive — today can be pending) was also logged.
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
  const last  = sortedDates[sortedDates.length - 1]
  let alive = true
  let d = nextDay(last)
  while (d < today) {
    if (!restSet.has(d) && !logSet.has(d)) { alive = false; break }
    d = nextDay(d)
  }

  return { current: alive ? run : 0, longest }
}

/** Progress through the month as a percentage (0–100). */
export function monthProgress(startDate: string, endDate: string): number {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
  if (today < startDate) return 0
  if (today > endDate)   return 100
  const start  = new Date(startDate + 'T00:00:00')
  const end    = new Date(endDate + 'T00:00:00')
  const now    = new Date(today + 'T00:00:00')
  const total  = (end.getTime() - start.getTime()) / 86_400_000 + 1
  const passed = (now.getTime() - start.getTime()) / 86_400_000 + 1
  return Math.round((passed / total) * 100)
}
