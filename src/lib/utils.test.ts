import { describe, it, expect } from 'vitest'
import { highlightMentions } from './utils'

const span = (name: string) =>
  `<span class="text-orange-400 font-semibold">@${name}</span>`

const tag = (name: string) =>
  `<span class="text-green-400">#${name}</span>`

// ─── highlightMentions ────────────────────────────────────────────────────────

describe('highlightMentions — no users (fallback)', () => {
  it('highlights a single-word mention', () => {
    expect(highlightMentions('@Snuggles great job')).toBe(
      `${span('Snuggles')} great job`
    )
  })

  it('does not consume words after the mention', () => {
    const result = highlightMentions('@Snuggles did 210 merkins')
    expect(result).toBe(`${span('Snuggles')} did 210 merkins`)
  })

  it('highlights a hashtag', () => {
    expect(highlightMentions('nice work #TheMerkingGauntlet')).toBe(
      `nice work ${tag('TheMerkingGauntlet')}`
    )
  })

  it('highlights both mention and hashtag', () => {
    expect(highlightMentions('@Airmail crushed it #TheMerkingGauntlet')).toBe(
      `${span('Airmail')} crushed it ${tag('TheMerkingGauntlet')}`
    )
  })
})

describe('highlightMentions — with users list', () => {
  const users = [
    { id: '1', displayName: 'Snuggles' },
    { id: '2', displayName: 'Sandman' },
    { id: '3', displayName: 'Big Daddy' },
    { id: '4', displayName: 'Big' },
  ]

  it('highlights a single-word name', () => {
    expect(highlightMentions('@Snuggles great job', users)).toBe(
      `${span('Snuggles')} great job`
    )
  })

  it('does not consume words after the name into the highlight', () => {
    const result = highlightMentions('@Snuggles did 210 merkins this morning', users)
    expect(result).toBe(`${span('Snuggles')} did 210 merkins this morning`)
  })

  it('highlights a multi-word name fully', () => {
    expect(highlightMentions('@Big Daddy crushed it', users)).toBe(
      `${span('Big Daddy')} crushed it`
    )
  })

  it('matches the longer name before the shorter prefix', () => {
    // "Big Daddy" should win over "Big" when both are in the list
    expect(highlightMentions('@Big Daddy is here', users)).toBe(
      `${span('Big Daddy')} is here`
    )
  })

  it('falls back to shorter name when longer does not match', () => {
    expect(highlightMentions('@Big showed up', users)).toBe(
      `${span('Big')} showed up`
    )
  })

  it('is case-insensitive', () => {
    expect(highlightMentions('@snuggles did the work', users)).toBe(
      `${span('snuggles')} did the work`
    )
  })

  it('handles multiple mentions in one string', () => {
    expect(highlightMentions('@Snuggles and @Sandman both showed up', users)).toBe(
      `${span('Snuggles')} and ${span('Sandman')} both showed up`
    )
  })

  it('does not highlight unknown names', () => {
    expect(highlightMentions('@Ghost showed up', users)).toBe('@Ghost showed up')
  })

  it('highlights hashtags alongside mentions', () => {
    expect(highlightMentions('@Snuggles crushed it #TheMerkingGauntlet', users)).toBe(
      `${span('Snuggles')} crushed it ${tag('TheMerkingGauntlet')}`
    )
  })

  it('leaves plain text untouched', () => {
    expect(highlightMentions('great workout today', users)).toBe('great workout today')
  })
})
