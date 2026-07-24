import { describe, it, expect } from 'vitest'
import { highlightMentions } from './utils'

const span = (name: string) =>
  `<span class="text-orange-400 font-semibold">@${name}</span>`

// A known user's mention renders as a tappable link to their profile.
const link = (name: string, id: string) =>
  `<a href="/profile/${id}" class="text-orange-400 font-semibold hover:underline">@${name}</a>`

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
    expect(highlightMentions('nice work #TheMerkinGauntlet')).toBe(
      `nice work ${tag('TheMerkinGauntlet')}`
    )
  })

  it('highlights both mention and hashtag', () => {
    expect(highlightMentions('@Airmail crushed it #TheMerkinGauntlet')).toBe(
      `${span('Airmail')} crushed it ${tag('TheMerkinGauntlet')}`
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

  it('links a single-word name to the profile', () => {
    expect(highlightMentions('@Snuggles great job', users)).toBe(
      `${link('Snuggles', '1')} great job`
    )
  })

  it('does not consume words after the name into the link', () => {
    const result = highlightMentions('@Snuggles did 210 merkins this morning', users)
    expect(result).toBe(`${link('Snuggles', '1')} did 210 merkins this morning`)
  })

  it('links a multi-word name fully', () => {
    expect(highlightMentions('@Big Daddy crushed it', users)).toBe(
      `${link('Big Daddy', '3')} crushed it`
    )
  })

  it('matches the longer name before the shorter prefix', () => {
    // "Big Daddy" should win over "Big" when both are in the list
    expect(highlightMentions('@Big Daddy is here', users)).toBe(
      `${link('Big Daddy', '3')} is here`
    )
  })

  it('falls back to shorter name when longer does not match', () => {
    expect(highlightMentions('@Big showed up', users)).toBe(
      `${link('Big', '4')} showed up`
    )
  })

  it('is case-insensitive', () => {
    expect(highlightMentions('@snuggles did the work', users)).toBe(
      `${link('snuggles', '1')} did the work`
    )
  })

  it('handles multiple mentions in one string', () => {
    expect(highlightMentions('@Snuggles and @Sandman both showed up', users)).toBe(
      `${link('Snuggles', '1')} and ${link('Sandman', '2')} both showed up`
    )
  })

  it('does not highlight unknown names', () => {
    expect(highlightMentions('@Ghost showed up', users)).toBe('@Ghost showed up')
  })

  it('links mentions alongside hashtags', () => {
    expect(highlightMentions('@Snuggles crushed it #TheMerkinGauntlet', users)).toBe(
      `${link('Snuggles', '1')} crushed it ${tag('TheMerkinGauntlet')}`
    )
  })

  it('leaves plain text untouched', () => {
    expect(highlightMentions('great workout today', users)).toBe('great workout today')
  })
})
