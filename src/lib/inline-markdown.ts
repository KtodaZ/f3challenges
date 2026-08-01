/**
 * The tiny slice of Markdown the changelog actually uses: `**bold**`,
 * `*italic*` and `` `code` ``. Parsing is kept separate from rendering so it
 * can be unit-tested without a DOM, and so nothing ever reaches
 * dangerouslySetInnerHTML — the caller builds real React elements from these
 * tokens.
 *
 * Deliberately not a Markdown library. Block syntax (headings, lists, links)
 * is not supported: entries are single sentences, and pulling in a parser for
 * three inline markers is not worth the bytes on a PWA. If a changelog bullet
 * ever needs a link, add a `link` token here rather than reaching for a dep.
 */

export type InlineToken =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'code'; text: string }

// Order matters: code first so markers inside a span stay literal, then bold
// so `**x**` is never read as an empty italic followed by a stray `*`.
const INLINE = /`([^`]+)`|\*\*(.+?)\*\*|\*([^*]+?)\*/g

/**
 * Splits a string into styled runs. Unmatched or unterminated markers are left
 * alone as plain text — a lone `*` in a bullet renders as an asterisk rather
 * than swallowing the rest of the line.
 */
export function parseInline(source: string): InlineToken[] {
  const tokens: InlineToken[] = []
  let last = 0

  // A fresh regex per call would be tidier, but lastIndex is reset below and
  // parseInline is never re-entered mid-scan.
  INLINE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = INLINE.exec(source)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', text: source.slice(last, m.index) })

    const [, code, bold, italic] = m
    if (code !== undefined) tokens.push({ type: 'code', text: code })
    else if (bold !== undefined) tokens.push({ type: 'bold', text: bold })
    else tokens.push({ type: 'italic', text: italic })

    last = m.index + m[0].length
  }

  if (last < source.length) tokens.push({ type: 'text', text: source.slice(last) })
  return tokens
}
