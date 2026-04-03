/**
 * Test the AI notification prompt with realistic scenarios.
 * Uses the same system prompt as functions/src/index.ts.
 *
 * Usage: node scripts/test-notifications.mjs
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envFile = readFileSync(join(__dirname, '../.env.local'), 'utf8')
const apiKey = envFile.match(/OPENAI_API_KEY=(.+)/)?.[1]?.trim()
if (!apiKey) { console.error('OPENAI_API_KEY not found in .env.local'); process.exit(1) }

// ── Keep this in sync with functions/src/index.ts ────────────────────────────
const SYSTEM_PROMPT = `You are a motivational coach for F3 Bedrock, a men's fitness accountability group.
Generate SHORT push notification messages. Rules:
- Title: max 6 words, punchy
- Body: max 20 words, direct
- Use F3 culture: PAX = members. Do NOT say "beatdown" — this is a monthly rep challenge, not a workout session
- Always reference the challenge by name (challengeName) not generic workout terms
- Use the person's name and real numbers (todayTarget reps total for the day)
- Suggest chipping away now — e.g. "knock out 50 now so you're not doing 200 tonight"
- As the month progresses (high dayNumber/totalDays ratio), increase urgency and pride — they're almost there
- If user NOT completed and completedNames has people: use peer pressure — name 1-2 of them ("Dredd already crushed it")
- If user NOT completed and notDoneNames has others too: softer — "you and X others still have time"
- If user completed and notDoneNames has people: encourage them to shoutout — name 1-2 who may need a nudge
- If user completed and everyone else is done: celebrate the whole crew
- If morning + not done: motivate, day is young, suggest starting a set now
- If evening + not done: urgent, last chance tonight
- If modifying: acknowledge the specific modification reason, still encourage
- Respond ONLY with valid JSON: {"title": "...", "body": "..."}`
// ─────────────────────────────────────────────────────────────────────────────

const scenarios = [
  {
    label: 'Morning, not done, some PAX already finished',
    ctx: {
      userName: 'Kyle', challengeName: 'The Merking Gauntlet',
      dayNumber: 2, totalDays: 30, todayTarget: 20,
      userCompleted: false, completionFraction: 0,
      groupCompletedCount: 4, groupTotalCount: 16, userStreak: 1,
      participationStatus: 'active', notificationType: 'morning',
      completedNames: ['Dredd', 'Handsaw', 'Roadkill'],
      notDoneNames: ['Rebar', 'Spackle', 'Oompa'],
    },
  },
  {
    label: 'Evening, not done, most PAX already finished',
    ctx: {
      userName: 'Kyle', challengeName: 'The Merking Gauntlet',
      dayNumber: 2, totalDays: 30, todayTarget: 20,
      userCompleted: false, completionFraction: 0,
      groupCompletedCount: 13, groupTotalCount: 16, userStreak: 0,
      participationStatus: 'active', notificationType: 'evening',
      completedNames: ['Dredd', 'Handsaw', 'Roadkill'],
      notDoneNames: ['Rebar', 'Spackle'],
    },
  },
  {
    label: 'Completed, a few PAX still need a nudge',
    ctx: {
      userName: 'Kyle', challengeName: 'The Merking Gauntlet',
      dayNumber: 2, totalDays: 30, todayTarget: 20,
      userCompleted: true, completionFraction: 1,
      groupCompletedCount: 10, groupTotalCount: 16, userStreak: 2,
      participationStatus: 'active', notificationType: 'morning',
      completedNames: ['Dredd', 'Handsaw'],
      notDoneNames: ['Rebar', 'Spackle', 'Oompa'],
    },
  },
  {
    label: 'Completed, everyone else is done too',
    ctx: {
      userName: 'Kyle', challengeName: 'The Merking Gauntlet',
      dayNumber: 2, totalDays: 30, todayTarget: 20,
      userCompleted: true, completionFraction: 1,
      groupCompletedCount: 16, groupTotalCount: 16, userStreak: 2,
      participationStatus: 'active', notificationType: 'evening',
      completedNames: ['Dredd', 'Handsaw', 'Roadkill'],
      notDoneNames: [],
    },
  },
  {
    label: 'Day 25 evening, not done, late in the month',
    ctx: {
      userName: 'Kyle', challengeName: 'The Merking Gauntlet',
      dayNumber: 25, totalDays: 30, todayTarget: 250,
      userCompleted: false, completionFraction: 0,
      groupCompletedCount: 10, groupTotalCount: 16, userStreak: 0,
      participationStatus: 'active', notificationType: 'evening',
      completedNames: ['Dredd', 'Handsaw', 'Roadkill'],
      notDoneNames: ['Rebar', 'Spackle'],
    },
  },
  {
    label: 'Modifying (bad shoulder), morning',
    ctx: {
      userName: 'Kyle', challengeName: 'The Merking Gauntlet',
      dayNumber: 2, totalDays: 30, todayTarget: 20,
      userCompleted: false, completionFraction: 0.5,
      groupCompletedCount: 3, groupTotalCount: 16, userStreak: 1,
      participationStatus: 'modifying: bad shoulder', notificationType: 'morning',
      completedNames: ['Dredd', 'Handsaw'],
      notDoneNames: ['Rebar', 'Spackle', 'Oompa'],
    },
  },
]

async function generate(ctx) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 80,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(ctx) },
      ],
    }),
  })
  const data = await res.json()
  return JSON.parse(data.choices[0].message.content)
}

for (const { label, ctx } of scenarios) {
  const { title, body } = await generate(ctx)
  console.log(`=== ${label} ===`)
  console.log(`  Title: ${title}`)
  console.log(`  Body:  ${body}`)
  console.log()
}
