'use client'

import { formatChangelogDate, type ChangelogEntry } from '@/lib/changelog'

interface ChangelogProps {
  entries: ChangelogEntry[]
}

/** Renders a list of changelog entries — date heading + bulleted changes.
 *  Purely presentational; callers decide which entries to pass. */
export function Changelog({ entries }: ChangelogProps) {
  return (
    <ol className="space-y-5">
      {entries.map(entry => (
        <li key={entry.date} className="relative pl-4 border-l border-zinc-800">
          <span className="absolute -left-[3px] top-1.5 w-1.5 h-1.5 rounded-full bg-orange-500" />
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1.5">
            {formatChangelogDate(entry.date)}
          </p>
          <ul className="space-y-1.5">
            {entry.changes.map((change, i) => (
              <li key={i} className="text-sm text-zinc-300 leading-snug">
                {change}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}
