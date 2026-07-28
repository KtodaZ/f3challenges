import { describe, it, expect } from 'vitest'
import { CHALLENGES } from './challenges'
import {
  getFeedPostTemplates,
  getNotificationTemplates,
  renderTemplate,
  renderNotification,
} from './copy'
import type { ChallengeTemplateCopy, FeedPostVars, NotificationVars } from './types'

// Every var a feed template is allowed to reference. A template using anything
// else renders the literal "{whatever}" into someone's feed.
const FEED_VARS: FeedPostVars = {
  name: 'Splice',
  day: 12,
  totalDays: 31,
  totalReps: 210,
  exerciseCount: 5,
  hashtag: '#JulyFFC',
  challengeName: 'July Functional Fitness Challenge',
  exerciseName: 'Merkin',
  daysLeft: 19,
  percent: 39,
  weekNumber: 2,
  stackedDays: 3,
  daysAway: 5,
}

const NOTIF_VARS: NotificationVars = {
  fn: 'Splice',
  dayNumber: 12,
  totalDays: 31,
  daysRemaining: 19,
  repsRemaining: 90,
  challengeName: 'July Functional Fitness Challenge',
  workRemaining: '20 incline merkins and 20 decline merkins',
}

const FEED_SECTIONS: Array<keyof NonNullable<ChallengeTemplateCopy['feedPost']>> = [
  'day1', 'quarter', 'half', 'threeQuarter', 'makeUp', 'regular', 'stacked', 'comeback',
]

const NOTIF_SECTIONS: Array<keyof NonNullable<ChallengeTemplateCopy['notification']>> = [
  'day1Completed', 'day1Pending',
  'quarterCompleted', 'quarterPending',
  'halfCompleted', 'halfPending',
  'threeQuarterCompleted', 'threeQuarterPending',
]

describe('feed post templates', () => {
  for (const challenge of CHALLENGES) {
    for (const section of FEED_SECTIONS) {
      it(`${challenge.id} / ${section}: every template renders with no leftover placeholders`, () => {
        const pool = getFeedPostTemplates(challenge, section)
        expect(pool.length).toBeGreaterThan(0)
        for (const template of pool) {
          const rendered = renderTemplate(
            template,
            FEED_VARS as unknown as Record<string, string | number | undefined>,
          )
          expect(rendered, template).not.toMatch(/[{}]/)
          expect(rendered.trim(), template).not.toBe('')
        }
      })
    }
  }

  it('mentions the PAX by name in every completion post', () => {
    for (const challenge of CHALLENGES) {
      for (const section of FEED_SECTIONS) {
        for (const template of getFeedPostTemplates(challenge, section)) {
          expect(template, `${challenge.id}/${section}`).toContain('@{name}')
        }
      }
    }
  })
})

describe('notification templates', () => {
  for (const challenge of CHALLENGES) {
    for (const section of NOTIF_SECTIONS) {
      it(`${challenge.id} / ${section}: titles and bodies render clean`, () => {
        const pair = getNotificationTemplates(challenge, section)
        expect(pair.titles.length).toBeGreaterThan(0)
        expect(pair.bodies.length).toBeGreaterThan(0)
        for (let seed = 0; seed < pair.titles.length * pair.bodies.length; seed++) {
          const { title, body } = renderNotification(pair, seed, NOTIF_VARS)
          expect(title, `${section} title @${seed}`).not.toMatch(/[{}]/)
          expect(body, `${section} body @${seed}`).not.toMatch(/[{}]/)
          // Push titles get truncated by the OS well before this.
          expect(title.length, title).toBeLessThanOrEqual(65)
        }
      })
    }
  }

  it('falls back to a rep count when no exercise-aware phrase is available', () => {
    const pair = getNotificationTemplates(CHALLENGES[0], 'day1Pending')
    const { body } = renderNotification(pair, 0, { ...NOTIF_VARS, workRemaining: undefined })
    expect(body).not.toMatch(/[{}]/)
  })
})

describe('per-challenge copy overrides', () => {
  it('augments the defaults instead of replacing them', () => {
    for (const challenge of CHALLENGES) {
      for (const section of FEED_SECTIONS) {
        const custom = challenge.copy?.feedPost?.[section] ?? []
        if (custom.length === 0) continue
        const merged = getFeedPostTemplates(challenge, section)
        expect(merged.length).toBeGreaterThan(custom.length)
        for (const template of custom) expect(merged).toContain(template)
      }
    }
  })
})
