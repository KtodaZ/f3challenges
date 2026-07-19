import { describe, it, expect } from 'vitest'
import { videoExtensionFor, MAX_FEED_VIDEOS } from './videos'

describe('videoExtensionFor', () => {
  it('uses the subtype as the extension', () => {
    expect(videoExtensionFor('video/mp4')).toBe('mp4')
    expect(videoExtensionFor('video/webm')).toBe('webm')
  })

  it('normalises iOS quicktime (.mov) to mov', () => {
    expect(videoExtensionFor('video/quicktime')).toBe('mov')
  })

  it('strips codec parameters', () => {
    expect(videoExtensionFor('video/mp4;codecs=avc1.42E01E')).toBe('mp4')
    expect(videoExtensionFor('video/webm; codecs="vp9"')).toBe('webm')
  })

  it('lowercases the extension', () => {
    expect(videoExtensionFor('VIDEO/MP4')).toBe('mp4')
  })

  it('falls back to mp4 when the type is empty or malformed', () => {
    expect(videoExtensionFor('')).toBe('mp4')
    expect(videoExtensionFor('video/')).toBe('mp4')
    expect(videoExtensionFor('notavideo')).toBe('mp4') // no "/" → fall back
  })
})

describe('MAX_FEED_VIDEOS', () => {
  it('is one video per post', () => {
    expect(MAX_FEED_VIDEOS).toBe(1)
  })
})
