import { describe, it, expect } from 'vitest'
import { isChallengeParticipant, PARTICIPANT_GRACE_DAYS } from './participation'

describe('isChallengeParticipant', () => {
  it('excludes anyone who explicitly opted out, regardless of activity', () => {
    expect(isChallengeParticipant('opted-out', true, 1)).toBe(false)
    expect(isChallengeParticipant('opted-out', true, 20)).toBe(false)
  })

  it('includes explicit opt-ins even with no logs', () => {
    expect(isChallengeParticipant('active', false, 20)).toBe(true)
    expect(isChallengeParticipant('modifying', false, 20)).toBe(true)
  })

  it('includes everyone during the grace window, before anyone can have logs', () => {
    expect(isChallengeParticipant(undefined, false, 1)).toBe(true)
    expect(isChallengeParticipant(undefined, false, PARTICIPANT_GRACE_DAYS)).toBe(true)
  })

  it('drops dormant signups once the grace window closes', () => {
    // The Hot Keys / Tacklebox / Thorpedo case: an account was created and
    // never used. Past the grace window it stops counting, which is what keeps
    // it out of crew totals and out of the "still needs theirs" push copy.
    expect(isChallengeParticipant(undefined, false, PARTICIPANT_GRACE_DAYS + 1)).toBe(false)
    expect(isChallengeParticipant(undefined, false, 25)).toBe(false)
  })

  it('keeps anyone who has logged, however late in the month', () => {
    expect(isChallengeParticipant(undefined, true, 25)).toBe(true)
  })
})
