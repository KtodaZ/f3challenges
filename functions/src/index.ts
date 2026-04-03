import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import OpenAI from "openai";

const openAiKey = defineSecret("OPENAI_API_KEY");

admin.initializeApp()

const DBG = 'https://example.ngrok-free.app'
async function dbg(label: string, data: unknown): Promise<void> {
  try {
    await fetch(DBG, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label, src: 'functions', data }) })
  } catch { /* non-blocking */ }
};

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
  fcmTokens?: string[];
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
  userId: string,
  tokens: string[],
  title: string,
  body: string,
  link = "/feed"
): Promise<void> {
  for (const token of tokens) {
    try {
      await admin.messaging().send({
        token,
        notification: { title, body },
        data: { link },
        webpush: {
          notification: { icon: "/icons/icon-192.png", badge: "/icons/notification-badge.png" },
          fcmOptions: { link },
        },
      });
    } catch (err: any) {
      if (err?.code === "messaging/registration-token-not-registered") {
        await admin.firestore().doc(`users/${userId}`).update({
          fcmTokens: admin.firestore.FieldValue.arrayRemove(token),
        });
      } else {
        console.error("FCM send failed:", err);
      }
    }
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
    await dbg('fn-entry', { fn: 'onFeedPostCreated', postId: post.id, type: post.type, authorId: post.authorId, mentions: post.mentions, targetUserId: post.targetUserId ?? null })

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

            await dbg('branch', { fn: 'onFeedPostCreated:mention', userId, tokenCount: user.fcmTokens?.length ?? 0, mentionsEnabled: user.notificationPreferences?.mentions })
            if (user.fcmTokens?.length) {
              await sendPushNotification(userId, user.fcmTokens, title, body);
              await dbg('fn-exit', { fn: 'sendPushNotification:mention', userId, title, tokenCount: user.fcmTokens.length })
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

          await dbg('branch', { fn: 'onFeedPostCreated:shoutout', userId, tokenCount: user.fcmTokens?.length ?? 0, isMentionOnly, mentionsEnabled: user.notificationPreferences?.mentions })
          if (user.fcmTokens?.length) {
            await sendPushNotification(userId, user.fcmTokens, title, body);
            await dbg('fn-exit', { fn: 'sendPushNotification:shoutout', userId, title, tokenCount: user.fcmTokens.length })
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
  userId: string;
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
    completedNames?: string[];   // PAX who have finished today
    notDoneNames?: string[];     // PAX who haven't finished today
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
- Respond ONLY with valid JSON: {"title": "...", "body": "..."}`,
        },
        { role: "user", content: JSON.stringify(ctx) },
      ],
    });
    const parsed = JSON.parse(res.choices[0].message.content ?? "{}");
    return { title: parsed.title ?? "F3 Bedrock", body: parsed.body ?? "Time to get after it." };
  } catch (err) {
    console.error("[AI] generateAINotification failed:", err);
    return { title: "F3 Bedrock", body: "Time to get after it, PAX." };
  }
}

export const sendScheduledNotifications = onSchedule(
  {
    schedule: "every 10 minutes",
    timeZone: "America/Los_Angeles",
    secrets: [openAiKey],
  },
  async () => {
    const today   = getTodayPT();
    const nowPT   = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
    const nowDate = new Date(nowPT);
    const nowHour = nowDate.getHours();
    const nowMin  = nowDate.getMinutes();
    const nowTotal = nowHour * 60 + nowMin;

    console.log(`[notify] ── run start ── ${nowPT} | today=${today} | nowTotal=${nowTotal}min`);

    const challenge = getChallengeForDate(today);
    if (!challenge) {
      console.log(`[notify] no active challenge for ${today}, exiting`);
      return;
    }
    console.log(`[notify] challenge=${challenge.name} day=${getDayNumber(challenge.startDate, today)}/${getTotalDays(challenge.startDate, challenge.endDate)}`);

    const dayNumber  = getDayNumber(challenge.startDate, today);
    const totalDays  = getTotalDays(challenge.startDate, challenge.endDate);
    const todayReps  = dayNumber * challenge.dailyMultiplier;

    const openai = new OpenAI({ apiKey: openAiKey.value().trim() });

    const usersSnap = await admin.firestore().collection("users").get();
    const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User & { notificationPreferences: NotifPrefs; currentStreak?: number }));
    console.log(`[notify] ${users.length} users total`);

    // Group completion stats for today
    const todayLogsSnap = await admin.firestore().collection("dailyLogs")
      .where("challengeId", "==", challenge.id)
      .where("date", "==", today)
      .get();
    const groupCompleted = todayLogsSnap.docs.filter(d => (d.data() as DailyLog).completionFraction >= 1).length;
    console.log(`[notify] group completion: ${groupCompleted}/${users.length} done today`);

    // Build name lookup for peer pressure messaging
    const userById = new Map(users.map(u => [u.id, u.displayName]));
    const completedUserIds = new Set(
      todayLogsSnap.docs
        .filter(d => (d.data() as DailyLog).completionFraction >= 1)
        .map(d => (d.data() as DailyLog).userId)
    );
    const allCompletedNames = [...completedUserIds].map(id => userById.get(id) ?? "").filter(Boolean);
    const allNotDoneNames = users
      .filter(u => !completedUserIds.has(u.id))
      .map(u => u.displayName);
    console.log(`[notify] completed: [${allCompletedNames.join(", ")}] | not done: [${allNotDoneNames.join(", ")}]`);

    for (const user of users) {
      await dbg('branch', { fn: 'sendScheduledNotifications:user-check', userId: user.id, userName: user.displayName, tokenCount: user.fcmTokens?.length ?? 0 })
      if (!user.fcmTokens?.length) {
        console.log(`[notify] skip ${user.displayName} — no fcmTokens`);
        continue;
      }
      const prefs = user.notificationPreferences;
      if (!prefs) {
        console.log(`[notify] skip ${user.displayName} — no notificationPreferences`);
        continue;
      }

      type NotifType = "morning" | "afternoon" | "evening" | "weekly_recap";
      const windows: Array<{ type: NotifType; enabled: boolean; time: string }> = [
        { type: "morning",      enabled: prefs.morning?.enabled ?? false,     time: prefs.morning?.time ?? "08:00" },
        { type: "afternoon",    enabled: prefs.afternoon?.enabled ?? false,    time: prefs.afternoon?.time ?? "17:00" },
        { type: "evening",      enabled: prefs.evening?.enabled ?? false,      time: prefs.evening?.time ?? "20:00" },
        { type: "weekly_recap", enabled: prefs.weeklyRecap?.enabled ?? false,  time: prefs.weeklyRecap?.time ?? "20:00" },
      ];

      console.log(`[notify] checking ${user.displayName} | windows: ${windows.filter(w => w.enabled).map(w => `${w.type}@${w.time}`).join(", ") || "none enabled"}`);

      for (const w of windows) {
        if (!w.enabled) continue;

        if (w.type === "weekly_recap") {
          const todayDay = nowDate.getDay();
          const prefDay  = prefs.weeklyRecap?.dayOfWeek ?? 0;
          if (todayDay !== prefDay) {
            console.log(`[notify]   ${w.type} skipped — today is day ${todayDay}, pref is day ${prefDay}`);
            continue;
          }
        }

        const [prefH, prefM] = w.time.split(":").map(Number);
        const prefTotal = prefH * 60 + prefM;
        const diffMins  = Math.abs(nowTotal - prefTotal);
        const WINDOW    = 5; // minutes either side — scheduler runs every 10 min so max drift is 5 min

        console.log(`[notify]   ${w.type}@${w.time} | now=${nowTotal}min pref=${prefTotal}min diff=${diffMins}min window=±${WINDOW}`);

        if (diffMins > WINDOW) {
          console.log(`[notify]   → outside window, skip`);
          continue;
        }

        const logKey = `${user.id}_${today}_${w.type}`;
        const alreadySent = await admin.firestore().collection("notificationLog").doc(logKey).get();
        if (alreadySent.exists) {
          console.log(`[notify]   → already sent (logKey=${logKey}), skip`);
          continue;
        }

        const userLogSnap = await admin.firestore().collection("dailyLogs").doc(`${user.id}_${today}`).get();
        const userLog = userLogSnap.exists ? (userLogSnap.data() as DailyLog) : null;
        const userCompleted = (userLog?.completionFraction ?? 0) >= 1;
        console.log(`[notify]   → user log: fraction=${userLog?.completionFraction ?? 0} completed=${userCompleted}`);

        const partSnap = await admin.firestore().collection("participation").doc(`${user.id}_${challenge.id}`).get();
        const part = partSnap.exists ? (partSnap.data() as ChallengeParticipation) : null;
        let statusStr = part?.status ?? "active";
        if (statusStr === "modifying" && part?.modificationNote) statusStr = `modifying: ${part.modificationNote}`;
        console.log(`[notify]   → participation: ${statusStr}`);

        try {
          console.log(`[notify]   → calling OpenAI for ${user.displayName}...`);
          const ctx = {
            userName:            user.displayName,
            challengeName:       challenge.name,
            dayNumber,
            totalDays,
            todayTarget:         todayReps,
            userCompleted,
            completionFraction:  userLog?.completionFraction ?? 0,
            groupCompletedCount: userCompleted ? groupCompleted - 1 : groupCompleted,
            groupTotalCount:     users.length - 1,
            userStreak:          (user as { currentStreak?: number }).currentStreak ?? 0,
            participationStatus: statusStr,
            notificationType:    w.type,
            completedNames: allCompletedNames.filter(n => n !== user.displayName).slice(0, 3),
            notDoneNames:   allNotDoneNames.filter(n => n !== user.displayName).slice(0, 3),
          };
          console.log(`[notify]   → AI ctx: ${JSON.stringify(ctx)}`);

          const { title, body } = await generateAINotification(openai, ctx);
          console.log(`[notify]   → AI response: title="${title}" body="${body}"`);
          await dbg('state', { fn: 'sendScheduledNotifications', userId: user.id, userName: user.displayName, notifType: w.type, title, body })

          await sendPushNotification(user.id, user.fcmTokens!, title, body, "/");
          console.log(`[notify]   → FCM sent OK`);
          await dbg('fn-exit', { fn: 'sendScheduledNotifications:fcm-sent', userId: user.id, userName: user.displayName, notifType: w.type, tokenCount: user.fcmTokens!.length })

          await admin.firestore().collection("notificationLog").doc(logKey).set({ sentAt: new Date().toISOString() });
          console.log(`[notify] ✓ sent ${w.type} to ${user.displayName}: "${title}"`);
        } catch (err) {
          console.error(`[notify] ✗ failed for ${user.displayName} ${w.type}:`, err);
        }
      }
    }

    console.log(`[notify] ── run complete ──`);
  }
);

// ---------------------------------------------------------------------------
// sendTestPush — manual HTTP trigger to send an AI-generated reminder
// Runs the full scheduled notification flow for one user, no time-window check.
//
// Usage:
//   curl -X POST <url> -H "Content-Type: application/json" \
//     -d '{"userId":"<id>"}'
//
// Optional overrides:
//   -d '{"userId":"<id>","notificationType":"evening"}'   (default: "morning")
//   -d '{"userId":"<id>","title":"Custom","body":"Hi"}'   (skip AI, send directly)
// ---------------------------------------------------------------------------
export const sendTestPush = onRequest(
  { secrets: [openAiKey] },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

    const { userId, title, body, notificationType = "morning" } = req.body ?? {};
    if (!userId) { res.status(400).json({ error: "userId required" }); return; }

    const userSnap = await admin.firestore().doc(`users/${userId}`).get();
    if (!userSnap.exists) { res.status(404).json({ error: "User not found" }); return; }
    const user = { id: userSnap.id, ...(userSnap.data() as Omit<User, "id"> & { currentStreak?: number }) };

    if (!user.fcmTokens?.length) { res.status(400).json({ error: `${user.displayName} has no fcmTokens` }); return; }

    let finalTitle: string;
    let finalBody: string;

    if (title && body) {
      finalTitle = title;
      finalBody = body;
    } else {
      const today = getTodayPT();
      const challenge = getChallengeForDate(today);
      if (!challenge) { res.status(400).json({ error: "No active challenge today" }); return; }

      const dayNumber = getDayNumber(challenge.startDate, today);
      const totalDays = getTotalDays(challenge.startDate, challenge.endDate);
      const todayReps = dayNumber * challenge.dailyMultiplier;

      const [userLogSnap, partSnap, usersSnap, allLogsSnap] = await Promise.all([
        admin.firestore().doc(`dailyLogs/${userId}_${today}`).get(),
        admin.firestore().doc(`participation/${userId}_${challenge.id}`).get(),
        admin.firestore().collection("users").get(),
        admin.firestore().collection("dailyLogs").where("challengeId", "==", challenge.id).where("date", "==", today).get(),
      ]);

      const userLog = userLogSnap.exists ? (userLogSnap.data() as DailyLog) : null;
      const part    = partSnap.exists    ? (partSnap.data()    as ChallengeParticipation) : null;
      let statusStr = part?.status ?? "active";
      if (statusStr === "modifying" && part?.modificationNote) statusStr = `modifying: ${part.modificationNote}`;

      const userById = new Map(usersSnap.docs.map(d => [d.id, (d.data() as User).displayName]));
      const completedIds = new Set(allLogsSnap.docs.filter(d => (d.data() as DailyLog).completionFraction >= 1).map(d => (d.data() as DailyLog).userId));
      const completedNames = [...completedIds].map(id => userById.get(id) ?? "").filter(n => n && n !== user.displayName).slice(0, 3);
      const notDoneNames   = usersSnap.docs.map(d => d.data() as User).filter(u => u.id !== userId && !completedIds.has(u.id)).map(u => u.displayName).slice(0, 3);

      const openai = new OpenAI({ apiKey: openAiKey.value().trim() });
      const result = await generateAINotification(openai, {
        userName: user.displayName, challengeName: challenge.name,
        dayNumber, totalDays, todayTarget: todayReps,
        userCompleted: (userLog?.completionFraction ?? 0) >= 1,
        completionFraction: userLog?.completionFraction ?? 0,
        groupCompletedCount: completedIds.size,
        groupTotalCount: usersSnap.size,
        userStreak: user.currentStreak ?? 0,
        participationStatus: statusStr,
        notificationType,
        completedNames,
        notDoneNames,
      });
      finalTitle = result.title;
      finalBody  = result.body;
    }

    await sendPushNotification(user.id, user.fcmTokens, finalTitle, finalBody, "/");
    res.json({ ok: true, sentTo: user.displayName, tokenCount: user.fcmTokens.length, title: finalTitle, body: finalBody });
  }
);
