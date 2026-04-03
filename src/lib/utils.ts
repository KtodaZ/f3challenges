import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Strip undefined values from an object before passing to Firestore setDoc/updateDoc. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
export function extractMentionNames(text: string): string[] {
  return [...text.matchAll(/@([\w\s]+?)(?=\s|$|[^a-zA-Z\s])/g)].map(m => m[1].trim())
}

/** Render post content with highlighted @mentions and #hashtags (returns plain string for now). */
export function highlightMentions(content: string): string {
  return content
    .replace(/@([\w ]+)/g, '<span class="text-orange-400 font-semibold">@$1</span>')
    .replace(/#(\w+)/g, '<span class="text-green-400">#$1</span>')
}

/** Streak from sorted array of YYYY-MM-DD log dates (most recent last). */
export function calculateStreak(sortedDates: string[]): { current: number; longest: number } {
  if (!sortedDates.length) return { current: 0, longest: 0 }

  let longest = 1
  let run = 1

  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1] + 'T00:00:00')
    const curr = new Date(sortedDates[i] + 'T00:00:00')
    const diff = Math.round((curr.getTime() - prev.getTime()) / 86_400_000)
    if (diff === 1) {
      run++
      if (run > longest) longest = run
    } else {
      run = 1
    }
  }

  // Check if streak extends to today or yesterday
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
  const last  = sortedDates[sortedDates.length - 1]
  const daysSinceLast = Math.round(
    (new Date(today + 'T00:00:00').getTime() - new Date(last + 'T00:00:00').getTime()) / 86_400_000
  )
  const current = daysSinceLast <= 1 ? run : 0

  return { current, longest }
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
