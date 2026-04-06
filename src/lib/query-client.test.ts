import { describe, it, expect } from 'vitest'
import { isNetworkBlockedError } from './query-client'

describe('isNetworkBlockedError', () => {
  it('returns false for non-Error values', () => {
    expect(isNetworkBlockedError('string error')).toBe(false)
    expect(isNetworkBlockedError(42)).toBe(false)
    expect(isNetworkBlockedError(null)).toBe(false)
    expect(isNetworkBlockedError(undefined)).toBe(false)
    expect(isNetworkBlockedError({ message: 'network error' })).toBe(false)
  })

  it('returns false for a generic Error', () => {
    expect(isNetworkBlockedError(new Error('something went wrong'))).toBe(false)
  })

  it('detects ERR_BLOCKED_BY_CLIENT', () => {
    expect(isNetworkBlockedError(new Error('ERR_BLOCKED_BY_CLIENT'))).toBe(true)
  })

  it('is case-insensitive for ERR_BLOCKED_BY_CLIENT', () => {
    expect(isNetworkBlockedError(new Error('net::ERR_BLOCKED_BY_CLIENT'))).toBe(true)
  })

  it('detects "network error"', () => {
    expect(isNetworkBlockedError(new Error('Network Error'))).toBe(true)
  })

  it('detects "failed to fetch"', () => {
    expect(isNetworkBlockedError(new Error('Failed to fetch'))).toBe(true)
  })

  it('detects "transport errored" (Firestore WebChannel)', () => {
    expect(isNetworkBlockedError(new Error('transport errored'))).toBe(true)
  })

  it('detects "websocket"', () => {
    expect(isNetworkBlockedError(new Error('WebSocket connection failed'))).toBe(true)
  })

  it('detects Firestore offline code "unavailable"', () => {
    const err = Object.assign(new Error('Service unavailable'), { code: 'unavailable' })
    expect(isNetworkBlockedError(err)).toBe(true)
  })

  it('does not flag errors with code other than "unavailable"', () => {
    const err = Object.assign(new Error('permission denied'), { code: 'permission-denied' })
    expect(isNetworkBlockedError(err)).toBe(false)
  })
})
