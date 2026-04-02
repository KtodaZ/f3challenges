import OpenAI from 'openai'

let _client: OpenAI | null = null
function getClient() {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _client
}

export interface NotificationContext {
  userName: string
  challengeName: string
  dayNumber: number
  totalDays: number
  todayTarget: number
  userCompleted: boolean
  completionFraction: number
  groupCompletedCount: number
  groupTotalCount: number
  userStreak: number
  participationStatus: string // 'active' | 'modifying: shoulder injury' | 'opted-out'
  notificationType: 'morning' | 'afternoon' | 'evening' | 'weekly_recap'
  weeklyCompletedDays?: number
  weeklyTotalDays?: number
}

export async function generateNotificationMessage(
  ctx: NotificationContext
): Promise<{ title: string; body: string }> {
  const response = await getClient().chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 80,
    messages: [
      {
        role: 'system',
        content: `You are a motivational coach for F3 Bedrock, a men's fitness accountability group.
Generate SHORT push notification messages. Rules:
- Title: max 6 words, punchy
- Body: max 20 words, direct
- Use F3 culture: PAX = members, beatdown = workout, EH = encourage a friend
- Never be generic. Use the person's name and real data.
- If user completed: encourage them to shout out others who haven't
- If morning + not done: fire up, day is young
- If evening + not done: urgent, last chance
- If modifying: acknowledge it, still push them
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
    return {
      title: parsed.title ?? 'F3 Bedrock',
      body: parsed.body ?? 'Time to get after it.',
    }
  } catch {
    return { title: 'F3 Bedrock', body: 'Time to get after it, PAX.' }
  }
}
