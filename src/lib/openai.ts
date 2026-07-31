import OpenAI from 'openai'

let _client: OpenAI | null = null
function getClient() {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _client
}

/**
 * Context for the personalized AI weekly recap push notification.
 * Assembled server-side in /api/notifications/recap from Firestore data;
 * the scheduled Cloud Function calls that route and falls back to an
 * algorithmic template if the AI path fails.
 */
export interface WeeklyRecapContext {
  userName: string
  challengeName: string
  hashtag: string
  dayNumber: number
  totalDays: number
  /** Days fully completed in the last 7 days (of daysPossibleThisWeek). */
  weeklyCompletedDays: number
  daysPossibleThisWeek: number
  weeklyReps: number
  /** Missed days the user went back and made up this week. */
  madeUpDaysThisWeek: number
  currentStreak: number
  /** Achievement badges unlocked in the last 7 days, e.g. "🔥 Week of Fire". */
  badgesEarnedThisWeek: string[]
  /** The badge the user is closest to earning, with distance, e.g. "2 days away". */
  nextBadge?: { name: string; emoji: string; remaining: string }
  /** Missed days still open to make up (comeback CTA). */
  missedDaysOutstanding: number
  /** 1-based rank by reps logged this week among active PAX. */
  groupWeeklyRank?: number
  groupSize?: number
  participationStatus: string // 'active' | 'modifying: …'
  /** Set on weekly-cumulative challenges: the week's pooled rep target and how
   *  much of it this PAX banked. On these, days completed is just "days
   *  trained" — the week's total is what actually counts. */
  weeklyTarget?: number
}

export async function generateWeeklyRecap(
  ctx: WeeklyRecapContext
): Promise<{ title: string; body: string }> {
  const response = await getClient().chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 140,
    messages: [
      {
        role: 'system',
        content: `You are a motivational coach for F3 Bedrock, a men's fitness accountability group, writing a personalized WEEKLY RECAP push notification.
Rules:
- Title: max 6 words, punchy, may include the person's name
- Body: max 45 words, direct, specific to their real week — never generic
- Use F3 culture sparingly: PAX = members, beatdown = workout
- Pick the 2-3 most interesting facts. Priority order:
  1. badges earned this week (celebrate them by name)
  2. a strong week (5+ days) or a comeback (madeUpDaysThisWeek > 0)
  3. nextBadge as a hook ("X away from Y — go get it")
  4. missedDaysOutstanding > 0 → nudge them to the Catch Up section
- If they had a rough week (0-2 days), be encouraging, never shaming; point forward
- If participationStatus starts with "modifying", acknowledge it and still push
- Numbers speak: use their real reps/days/rank, don't round away specifics
- Respond ONLY with valid JSON: {"title": "...", "body": "..."}`,
      },
      {
        role: 'user',
        content: JSON.stringify(ctx),
      },
    ],
    response_format: { type: 'json_object' },
  })

  const text = response.choices[0].message.content ?? '{}'
  try {
    const parsed = JSON.parse(text)
    if (typeof parsed.title !== 'string' || typeof parsed.body !== 'string') {
      throw new Error('bad shape')
    }
    return { title: parsed.title, body: parsed.body }
  } catch {
    return {
      title: `Week in Review, ${ctx.userName}`,
      body: ctx.weeklyTarget
        ? `${ctx.weeklyReps.toLocaleString()} of ${ctx.weeklyTarget.toLocaleString()} reps this week in ${ctx.challengeName}. 💪`
        : `Day ${ctx.dayNumber} of ${ctx.totalDays} in ${ctx.challengeName}. ${ctx.weeklyCompletedDays}/${ctx.daysPossibleThisWeek} days this week — keep showing up.`,
    }
  }
}
