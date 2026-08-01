import { describe, it, expect } from 'vitest'
import { parseInline } from './inline-markdown'
import { CHANGELOG } from './changelog'

describe('parseInline', () => {
  it('leaves plain text as a single token', () => {
    expect(parseInline('nothing to see here')).toEqual([
      { type: 'text', text: 'nothing to see here' },
    ])
  })

  it('pulls bold, italic and code out of the surrounding text', () => {
    expect(parseInline('hit **300** reps')).toEqual([
      { type: 'text', text: 'hit ' },
      { type: 'bold', text: '300' },
      { type: 'text', text: ' reps' },
    ])
    expect(parseInline('log *something*')).toEqual([
      { type: 'text', text: 'log ' },
      { type: 'italic', text: 'something' },
    ])
    expect(parseInline('shows as `2×25`')).toEqual([
      { type: 'text', text: 'shows as ' },
      { type: 'code', text: '2×25' },
    ])
  })

  it('does not read bold as two italics', () => {
    expect(parseInline('**Catch Up**')).toEqual([{ type: 'bold', text: 'Catch Up' }])
  })

  it('handles several spans in one line', () => {
    expect(parseInline('**a** then **b**')).toEqual([
      { type: 'bold', text: 'a' },
      { type: 'text', text: ' then ' },
      { type: 'bold', text: 'b' },
    ])
  })

  it('keeps markers inside a code span literal', () => {
    expect(parseInline('`**not bold**`')).toEqual([{ type: 'code', text: '**not bold**' }])
  })

  it('leaves an unterminated marker as text rather than eating the line', () => {
    expect(parseInline('5 * 3 = 15')).toEqual([{ type: 'text', text: '5 * 3 = 15' }])
    expect(parseInline('a **dangling start')).toEqual([{ type: 'text', text: 'a **dangling start' }])
  })

  it('round-trips every shipped changelog bullet', () => {
    for (const entry of CHANGELOG) {
      for (const change of entry.changes) {
        const rebuilt = parseInline(change)
          .map(t =>
            t.type === 'bold' ? `**${t.text}**`
            : t.type === 'italic' ? `*${t.text}*`
            : t.type === 'code' ? `\`${t.text}\``
            : t.text
          )
          .join('')
        expect(rebuilt).toBe(change)
      }
    }
  })

  it('leaves no stray markers in the rendered text of a shipped bullet', () => {
    for (const entry of CHANGELOG) {
      for (const change of entry.changes) {
        const rendered = parseInline(change).map(t => t.text).join('')
        expect(rendered).not.toMatch(/\*|`/)
      }
    }
  })
})
