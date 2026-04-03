import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import OpenAI from "openai";

const openAiKey = defineSecret("OPENAI_API_KEY");

admin.initializeApp();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FeedPost {
  id: string;
  type: "post" | "shoutout" | "system";
  authorId: string;
  content: string;
  hashtags: string[];
  mentions: string[]; // user IDs
  targetUserId?: string;
  createdAt: string;
  deleted: boolean;
}

interface User {
  id: string;
  displayName: string;
  fcmToken?: string;
  notificationPreferences: {
    mentions: boolean;
  };
}

interface AppNotification {
  id: string;
  userId: string;
  type: "mention" | "shoutout" | "system";
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  relatedPostId?: string;
  relatedUserId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nanoid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function truncate(text: string, maxLen: number): string {
  return text.length <= maxLen ? text : text.slice(0, maxLen - 1) + "…";
}

async function getUser(userId: string): Promise<User | null> {
  const snap = await admin.firestore().doc(`users/${userId}`).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as Omit<User, "id">) };
}

async function sendPushNotification(
  fcmToken: string,
  title: string,
  body: string
): Promise<void> {
  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      webpush: {
        fcmOptions: { link: "/feed" },
      },
    });
  } catch (err) {
    console.error("FCM send failed:", err);
  }
}

async function createNotification(
  notification: AppNotification
): Promise<void> {
  const { userId, id } = notification;
  await admin
    .firestore()
    .doc(`notifications/${userId}/items/${id}`)
    .set(notification);
}

// ---------------------------------------------------------------------------
// onFeedPostCreated
// ---------------------------------------------------------------------------

export const onFeedPostCreated = onDocumentCreated(
  "feed/{postId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const post = { id: snap.id, ...(snap.data() as Omit<FeedPost, "id">) };

    if (post.type === "post") {
      const mentions = post.mentions ?? [];
      if (mentions.length === 0) return;

      const author = await getUser(post.authorId);
      const authorName = author?.displayName ?? "Someone";
      const title = `@${authorName} mentioned you`;
      const body = truncate(post.content, 80);

      await Promise.all(
        mentions
          .filter((uid) => uid !== post.authorId)
          .map(async (userId) => {
            const user = await getUser(userId);
            if (!user) return;
            if (!user.notificationPreferences?.mentions) return;

            const notifId = nanoid();
            const notification: AppNotification = {
              id: notifId,
              userId,
              type: "mention",
              title,
              body,
              read: false,
              createdAt: new Date().toISOString(),
              relatedPostId: post.id,
              relatedUserId: post.authorId,
            };

            await createNotification(notification);

            if (user.fcmToken) {
              await sendPushNotification(user.fcmToken, title, body);
            }
          })
      );
    } else if (post.type === "shoutout") {
      const author = await getUser(post.authorId);
      const authorName = author?.displayName ?? "Someone";
      const title = `@${authorName} shouted you out! 💪`;
      const body = truncate(post.content, 80);

      // Collect recipients: mentions (excluding author) + targetUserId
      const recipientSet = new Set<string>(
        (post.mentions ?? []).filter((uid) => uid !== post.authorId)
      );
      if (post.targetUserId && post.targetUserId !== post.authorId) {
        recipientSet.add(post.targetUserId);
      }

      await Promise.all(
        Array.from(recipientSet).map(async (userId) => {
          const user = await getUser(userId);
          if (!user) return;

          // targetUserId always gets notified; mention recipients respect prefs
          const isMentionOnly =
            !post.targetUserId || post.targetUserId !== userId;
          if (isMentionOnly && !user.notificationPreferences?.mentions) return;

          const notifId = nanoid();
          const notification: AppNotification = {
            id: notifId,
            userId,
            type: "shoutout",
            title,
            body,
            read: false,
            createdAt: new Date().toISOString(),
            relatedPostId: post.id,
            relatedUserId: post.authorId,
          };

          await createNotification(notification);

          if (user.fcmToken) {
            await sendPushNotification(user.fcmToken, title, body);
          }
        })
      );
    }
  }
);

// ---------------------------------------------------------------------------
// onUserCreated
// ---------------------------------------------------------------------------

export const onUserCreated = onDocumentCreated(
  "users/{userId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const userId = snap.id;
    const user = snap.data() as Omit<User, "id">;

    // Give the user a moment to finish onboarding before the welcome post appears
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const postId = nanoid();
    const welcomePost: FeedPost = {
      id: postId,
      type: "system",
      authorId: "system",
      content: `@${user.displayName} just joined the F3 Bedrock challenge! Welcome to the crew! 💪`,
      hashtags: [],
      mentions: [userId],
      createdAt: new Date().toISOString(),
      deleted: false,
    };

    await admin.firestore().doc(`feed/${postId}`).set(welcomePost);
  }
);

// ---------------------------------------------------------------------------
// sendScheduledNotifications — runs every hour, PT timezone
// Checks each user's preferred notification times and sends AI-generated
// push notifications to those due within the current hour window.
// ---------------------------------------------------------------------------

interface NotifPrefs {
  morning:     { enabled: boolean; time: string };
  afternoon:   { enabled: boolean; time: string };
  evening:     { enabled: boolean; time: string };
  weeklyRecap: { enabled: boolean; time: string; dayOfWeek: number };
  mentions:    boolean;
}

interface DailyLog {
  completionFraction: number;
  date: string;
}

interface ChallengeParticipation {
  status: string;
  modificationNote?: string;
}

function getChallengeForDate(date: string): { id: string; name: string; dailyMultiplier: number; exercises: { id: string }[]; startDate: string; endDate: string } | null {
  const CHALLENGES = [
    { id: "apr-2026", name: "The Merking Gauntlet", dailyMultiplier: 10, exercises: [{id:"merkin"},{id:"diamond-merkin"},{id:"wide-merkin"},{id:"incline-merkin"},{id:"decline-merkin"}], startDate: "2026-04-01", endDate: "2026-04-30" },
    { id: "may-2026", name: "May Challenge", dailyMultiplier: 10, exercises: [{id:"tbd"}], startDate: "2026-05-01", endDate: "2026-05-31" },
  ];
  return CHALLENGES.find(c => date >= c.startDate && date <= c.endDate) ?? null;
}

function getDayNumber(startDate: string, date: string): number {
  const start = new Date(startDate + "T00:00:00Z");
  const d     = new Date(date + "T00:00:00Z");
  return Math.round((d.getTime() - start.getTime()) / 86_400_000) + 1;
}

function getTotalDays(startDate: string, endDate: string): number {
  const start = new Date(startDate + "T00:00:00Z");
  const end   = new Date(endDate + "T00:00:00Z");
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function getTodayPT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

async function generateAINotification(
  client: OpenAI,
  ctx: {
    userName: string; challengeName: string; dayNumber: number; totalDays: number;
    todayTarget: number; userCompleted: boolean; completionFraction: number;
    groupCompletedCount: number; groupTotalCount: number; userStreak: number;
    participationStatus: string; notificationType: string;
    weeklyCompletedDays?: number;
  }
): Promise<{ title: string; body: string }> {
  try {
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 80,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a motivational coach for F3 Bedrock, a men's fitness accountability group.
Generate SHORT push notification messages. Rules:
- Title: max 6 words, punchy
- Body: max 20 words, direct
- Use F3 culture: PAX = members, beatdown = workout
- Use the person's name and real numbers
- As the month progresses (high dayNumber/totalDays ratio), increase urgency and pride — they're almost there
- If user completed: encourage shoutouts to others who haven't
- If morning + not done: motivate, day is young
- If evening + not done: urgent, last chance tonight
- If modifying: acknowledge modification, still encourage
- Respond ONLY with valid JSON: {"title": "...", "body": "..."}`,
        },
        { role: "user", content: JSON.stringify(ctx) },
      ],
    });
    const parsed = JSON.parse(res.choices[0].message.content ?? "{}");
    return { title: parsed.title ?? "F3 Bedrock", body: parsed.body ?? "Time to get after it." };
  } catch {
    return { title: "F3 Bedrock", body: "Time to get after it, PAX." };
  }
}

export const sendScheduledNotifications = onSchedule(
  {
    schedule: "every 60 minutes",
    timeZone: "America/Los_Angeles",
    secrets: [openAiKey],
  },
  async () => {
    const today   = getTodayPT();
    const nowPT   = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
    const nowDate = new Date(nowPT);
    const nowHour = nowDate.getHours();
    const nowMin  = nowDate.getMinutes();

    const challenge = getChallengeForDate(today);
    if (!challenge) return;

    const dayNumber  = getDayNumber(challenge.startDate, today);
    const totalDays  = getTotalDays(challenge.startDate, challenge.endDate);
    const todayReps  = dayNumber * challenge.dailyMultiplier;

    const openai = new OpenAI({ apiKey: openAiKey.value() });

    const usersSnap = await admin.firestore().collection("users").get();
    const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User & { notificationPreferences: NotifPrefs; currentStreak?: number }));

    // Group completion stats for today
    const todayLogsSnap = await admin.firestore().collection("dailyLogs")
      .where("challengeId", "==", challenge.id)
      .where("date", "==", today)
      .get();
    const groupCompleted = todayLogsSnap.docs.filter(d => (d.data() as DailyLog).completionFraction >= 1).length;

    for (const user of users) {
      if (!user.fcmToken) continue;
      const prefs = user.notificationPreferences;
      if (!prefs) continue;

      type NotifType = "morning" | "afternoon" | "evening" | "weekly_recap";
      const windows: Array<{ type: NotifType; enabled: boolean; time: string }> = [
        { type: "morning",      enabled: prefs.morning?.enabled ?? false,     time: prefs.morning?.time ?? "08:00" },
        { type: "afternoon",    enabled: prefs.afternoon?.enabled ?? false,    time: prefs.afternoon?.time ?? "17:00" },
        { type: "evening",      enabled: prefs.evening?.enabled ?? false,      time: prefs.evening?.time ?? "20:00" },
        { type: "weekly_recap", enabled: prefs.weeklyRecap?.enabled ?? false,  time: prefs.weeklyRecap?.time ?? "20:00" },
      ];

      for (const w of windows) {
        if (!w.enabled) continue;
        if (w.type === "weekly_recap" && nowDate.getDay() !== (prefs.weeklyRecap?.dayOfWeek ?? 0)) continue;

        const [prefH, prefM] = w.time.split(":").map(Number);
        const diffMins = Math.abs((nowHour * 60 + nowMin) - (prefH * 60 + prefM));
        if (diffMins > 30) continue; // within 30-min window of the scheduled hour

        const logKey = `${user.id}_${today}_${w.type}`;
        const alreadySent = await admin.firestore().collection("notificationLog").doc(logKey).get();
        if (alreadySent.exists) continue;

        const userLogSnap = await admin.firestore().collection("dailyLogs").doc(`${user.id}_${today}`).get();
        const userLog = userLogSnap.exists ? (userLogSnap.data() as DailyLog) : null;

        const partSnap = await admin.firestore().collection("participation").doc(`${user.id}_${challenge.id}`).get();
        const part = partSnap.exists ? (partSnap.data() as ChallengeParticipation) : null;
        let statusStr = part?.status ?? "active";
        if (statusStr === "modifying" && part?.modificationNote) statusStr = `modifying: ${part.modificationNote}`;

        try {
          const { title, body } = await generateAINotification(openai, {
            userName:            user.displayName,
            challengeName:       challenge.name,
            dayNumber,
            totalDays,
            todayTarget:         todayReps,
            userCompleted:       (userLog?.completionFraction ?? 0) >= 1,
            completionFraction:  userLog?.completionFraction ?? 0,
            groupCompletedCount: groupCompleted,
            groupTotalCount:     users.length,
            userStreak:          (user as { currentStreak?: number }).currentStreak ?? 0,
            participationStatus: statusStr,
            notificationType:    w.type,
          });

          await admin.messaging().send({
            token: user.fcmToken,
            notification: { title, body },
            webpush: {
              notification: { icon: "/icons/icon-192.png", badge: "/icons/icon-192.png" },
              fcmOptions: { link: "/" },
            },
          });

          await admin.firestore().collection("notificationLog").doc(logKey).set({ sentAt: new Date().toISOString() });
        } catch (err) {
          console.error(`[notify] failed for ${user.displayName}:`, err);
        }
      }
    }
  }
);
