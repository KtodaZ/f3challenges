'use client'

import { formatChangelogDate, type ChangelogEntry } from '@/lib/changelog'
import { parseInline } from '@/lib/inline-markdown'

interface ChangelogProps {
  entries: ChangelogEntry[]
}

/** Entries are written with `**bold**`, `*italic*` and `` `code` `` — turn
 *  those into elements instead of printing the markers. */
function Formatted({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((tok, i) => {
        switch (tok.type) {
          case 'bold':
            return <strong key={i} className="font-semibold text-white">{tok.text}</strong>
          case 'italic':
            return <em key={i} className="italic">{tok.text}</em>
          case 'code':
            return (
              <code
                key={i}
                className="px-1 py-0.5 rounded bg-zinc-800 text-orange-300 text-[0.85em] font-mono tabular-nums"
              >
                {tok.text}
              </code>
            )
          default:
            return <span key={i}>{tok.text}</span>
        }
      })}
    </>
  )
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
                <Formatted text={change} />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}
