import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
// import { defineSecret } from "firebase-functions/params"; // ← uncomment on AI recap activation
import {
  getChallengeForDate,
  getChallengeById,
  getRequiredDays,
  getDayNumber,
  getTotalDays,
  getMilestoneDays,
  getTodayPT,
  getDailyTarget,
  getNotificationTemplates,
  renderNotification,
  getRemainingExercises,
  formatRemainingWork,
  getRemainingNudge,
} from "@f3-bedrock/shared";
import type { ChallengeTemplate, DailyTarget, NotificationVars } from "@f3-bedrock/shared";

admin.initializeApp()

// ---------------------------------------------------------------------------
// Types (app-specific — not in @f3-bedrock/shared)
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

interface NotifPrefs {
  morning:     { enabled: boolean; time: string };
  afternoon:   { enabled: boolean; time: string };
  evening:     { enabled: boolean; time: string };
  weeklyRecap: { enabled: boolean; time: string; dayOfWeek: number };
  mentions:    boolean;
  competitive?: boolean;
}

interface ExerciseLogEntry {
  exerciseId: string;
  targetReps: number;
  completedReps: number;
}

interface DailyLog {
  completionFraction: number;
  date: string;
  userId: string;
  exerciseLogs?: ExerciseLogEntry[];
}

interface ChallengeParticipation {
  userId: string;
  challengeId: string;
  status: string;
  modificationNote?: string;
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
          notification: { badge: "/icons/notification-badge.png" },
          fcmOptions: { link },
        },
      });
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === "messaging/registration-token-not-registered") {
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

            if (user.fcmTokens?.length) {
              await sendPushNotification(userId, user.fcmTokens, title, body);
            }
          })
      );
    } else if (post.type === "shoutout") {
      const author = await getUser(post.authorId);
      const authorName = author?.displayName ?? "Someone";

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

          const title = `@${authorName} shouted you out! 💪`;
          const body = truncate(post.content, 80);

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

          if (user.fcmTokens?.length) {
            await sendPushNotification(userId, user.fcmTokens, title, body);
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

    const challenge = getChallengeForDate(getTodayPT());
    const challengeLabel = challenge ? challenge.name : "F3 Bedrock";

    const templates = [
      `@${user.displayName} just joined ${challengeLabel}! Welcome to the crew! 💪`,
      `New PAX alert! @${user.displayName} is in for ${challengeLabel}. Let's get it! 🔥`,
      `@${user.displayName} has entered the chat — welcome to ${challengeLabel}! 💪`,
      `@${user.displayName} just laced up for ${challengeLabel}. The crew just got stronger! 🙌`,
      `Heads up PAX — @${user.displayName} is locked in for ${challengeLabel}. Welcome! 🔥`,
      `The crew grows! @${user.displayName} just joined ${challengeLabel}. Let's go! 💪`,
      `@${user.displayName} is here and ready for ${challengeLabel}. Welcome to F3 Bedrock! 🙌`,
      `@${user.displayName} just showed up for ${challengeLabel}. That's how it's done! 🔥`,
    ];

    const postId = nanoid();
    const welcomePost: FeedPost = {
      id: postId,
      type: "system",
      authorId: "system",
      content: templates[Math.floor(Math.random() * templates.length)],
      hashtags: [],
      mentions: [userId],
      createdAt: new Date().toISOString(),
      deleted: false,
    };

    await admin.firestore().doc(`feed/${postId}`).set(welcomePost);
  }
);

// ---------------------------------------------------------------------------
// sendScheduledNotifications — runs every 10 min, PT timezone
// Checks each user's preferred notification times and sends algorithmic
// push notifications to those due within the current window.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Algorithmic notification generation
// ---------------------------------------------------------------------------

// Seed varies by day and notification type so the same user sees different
// templates across days; morning/afternoon/evening also pick different ones.
function notifSeed(dayNumber: number, notifType: string): number {
  let h = 0;
  for (const c of notifType) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h + dayNumber * 997;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function firstName(name: string): string {
  return name.split(" ")[0];
}

// "Alice"              → "Alice"
// "Alice, Bob"         → "Alice and Bob"
// "Alice, Bob, Charlie, Dave" → "Alice, Bob, and 2 others"
function fmtNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  const others = names.length - 2;
  return `${names[0]}, ${names[1]}, and ${others} other${others > 1 ? "s" : ""}`;
}

function generateNotification(ctx: {
  challenge: ChallengeTemplate;
  dailyTarget: DailyTarget;
  exerciseLogs: ExerciseLogEntry[] | null;
  userName: string; challengeName: string; dayNumber: number; totalDays: number;
  todayTarget: number; repsCompleted: number; repsRemaining: number;
  repsPerExercise: number; primaryExercise: string;
  userCompleted: boolean; completionFraction: number;
  groupCompletedCount: number; groupTotalCount: number; userStreak: number;
  participationStatus: string; notificationType: string;
  completedNames: string[]; notDoneNames: string[];
}): { title: string; body: string } {
  const {
    challenge, dailyTarget, exerciseLogs,
    userName, challengeName, dayNumber, totalDays,
    repsCompleted, repsRemaining,
    userCompleted, groupCompletedCount, groupTotalCount,
    notificationType, completedNames, notDoneNames,
    participationStatus, userStreak,
  } = ctx;

  const fn = firstName(userName);
  const seed = notifSeed(dayNumber, notificationType);
  const daysRemaining = totalDays - dayNumber;

  // Exercise-aware "what's left" copy: "20 incline merkins and 20 decline
  // merkins" beats "40 reps". nudge is a full custom sentence ("finish those
  // dead hangs...") available when ≤3 exercises remain.
  const remaining = getRemainingExercises(dailyTarget, exerciseLogs);
  const exerciseCount = dailyTarget.exercises.filter(e => e.reps > 0).length;
  const workLeft = formatRemainingWork(remaining, exerciseCount) || `${repsRemaining} reps`;
  const nudge = getRemainingNudge(remaining, seed);

  const notifVars: NotificationVars = { fn, dayNumber, totalDays, daysRemaining, repsRemaining, challengeName, workRemaining: workLeft };
  const daysWord = daysRemaining === 1 ? "day" : "days";
  const isEndgame = daysRemaining <= 3;
  const isLate = daysRemaining <= 10;
  const hasPeers = completedNames.length > 0;
  const hasPartners = notDoneNames.length > 0;
  const peerStr = fmtNames(completedNames);
  const peerVerb = completedNames.length === 1 ? "has" : "have";
  const partnerStr = fmtNames(notDoneNames);
  const progressNote = repsCompleted > 0
    ? `${workLeft} still to go`
    : `${workLeft} to go`;

  // --- Milestone days ---
  const { quarter: quarterDay, half: halfDay, threeQuarter: threeQuarterDay } = getMilestoneDays(challenge);

  if (dayNumber === 1) {
    const section = userCompleted ? "day1Completed" as const : "day1Pending" as const;
    return renderNotification(getNotificationTemplates(challenge, section), seed, notifVars);
  }

  if (dayNumber === quarterDay) {
    const section = userCompleted ? "quarterCompleted" as const : "quarterPending" as const;
    return renderNotification(getNotificationTemplates(challenge, section), seed, notifVars);
  }

  if (dayNumber === halfDay) {
    const section = userCompleted ? "halfCompleted" as const : "halfPending" as const;
    return renderNotification(getNotificationTemplates(challenge, section), seed, notifVars);
  }

  if (dayNumber === threeQuarterDay) {
    const section = userCompleted ? "threeQuarterCompleted" as const : "threeQuarterPending" as const;
    return renderNotification(getNotificationTemplates(challenge, section), seed, notifVars);
  }

  // --- Weekly recap ---
  if (notificationType === "weekly_recap") {
    const streakLine = userStreak > 1
      ? `${userStreak}-day streak — keep it alive!`
      : "Every rep counts — stay the course.";
    const bodies = [
      `Day ${dayNumber} of ${totalDays}. ${streakLine}`,
      `You're ${Math.round((dayNumber / totalDays) * 100)}% through ${challengeName}. ${userStreak > 0 ? `${userStreak}-day streak — don't stop now.` : "Keep showing up."}`,
      `${daysRemaining} ${daysWord} left in ${challengeName}. Stay the course, ${fn}.`,
      `Week in the books. Day ${dayNumber}/${totalDays} on ${challengeName}. ${streakLine}`,
    ];
    return { title: `Week in Review, ${fn}`, body: pick(bodies, seed) };
  }

  // --- User completed ---
  if (userCompleted) {
    if (notDoneNames.length === 0) {
      // Whole crew done
      const titles = [
        "Whole Crew Showed Up! 💪",
        `Day ${dayNumber} — Full House!`,
        "PAX All In — That's F3!",
        "Every PAX Finished Today!",
        "Clean Sweep, PAX!",
      ];
      const bodies = [
        `Every PAX crushed Day ${dayNumber}. F3 Bedrock coming through!`,
        `All ${groupTotalCount} PAX done. Day ${dayNumber} belongs to the crew!`,
        `Full house on Day ${dayNumber}! That's the standard, ${fn}.`,
        `Nobody left behind — whole PAX finished Day ${dayNumber}. Let's go!`,
        `${groupTotalCount} for ${groupTotalCount} today. That's what F3 Bedrock is about.`,
      ];
      return { title: pick(titles, seed), body: pick(bodies, seed + 1) };
    } else {
      // Done — nudge others
      const titles = [
        `You're Done, ${fn}! 🔥`,
        `Day ${dayNumber} Crushed, ${fn}!`,
        `Nice Work, ${fn}!`,
        `${fn} Checked In! ✅`,
        `Rep That, ${fn}!`,
        `Lead By Example, ${fn}`,
      ];
      const plural = notDoneNames.length === 1 ? "hasn't" : "haven't";
      const needPlural = notDoneNames.length === 1 ? "needs" : "need";
      const bodies = [
        `${partnerStr} ${plural} finished yet — hit their name in the feed.`,
        `${groupCompletedCount}/${groupTotalCount} PAX done. Drop a shoutout to fire up ${partnerStr}.`,
        `You led the way. ${partnerStr} still grinding — give them a push.`,
        `${partnerStr} still ${needPlural} Day ${dayNumber}'s reps. Tag them in the feed.`,
        `Solid work. Now drag ${partnerStr} across the finish line.`,
        `${groupCompletedCount}/${groupTotalCount} done — ${partnerStr} still out there. Send the encouragement.`,
      ];
      return { title: pick(titles, seed), body: pick(bodies, seed + 1) };
    }
  }

  // --- Modifying participation — acknowledge and still encourage ---
  const modNote = participationStatus.startsWith("modifying")
    ? "Scaled or not, "
    : "";

  // --- Endgame (last 3 days) — heavy urgency with countdown ---
  if (isEndgame) {
    const titles = [
      `${daysRemaining} ${daysWord} Left — Don't Fold`,
      `Almost There, ${fn}!`,
      `Final Push, ${fn}!`,
      `${daysRemaining} ${daysWord} Remaining — Go!`,
      `Finish What You Started`,
      `So Close, ${fn} — Don't Stop`,
      `The End Is in Sight`,
    ];
    const peerLine = hasPeers ? `${peerStr} ${peerVerb} completed today's challenge. ` : "";
    const bodies = [
      `${peerLine}${daysRemaining} ${daysWord} left — ${workLeft} between you and the finish line.`,
      `${modNote}${progressNote}. ${daysRemaining} ${daysWord} in ${challengeName}. Don't quit this close to done.`,
      `${fn}, ${daysRemaining} ${daysWord} left — ${workLeft} now. The crew is watching.`,
      `You've come too far to stop. ${workLeft} today, ${daysRemaining} ${daysWord} to go — finish strong.`,
      `${peerLine}${progressNote}. ${daysRemaining} ${daysWord} left — make it count.`,
      `${daysRemaining} ${daysWord} left in ${challengeName}. ${workLeft} today — this is what you trained for.`,
      `${modNote}${workLeft} left. ${daysRemaining} ${daysWord} remaining — leave nothing on the table, ${fn}.`,
    ];
    if (nudge) bodies.push(nudge, `${peerLine}${nudge}`);
    return { title: pick(titles, seed), body: pick(bodies, seed + 1) };
  }

  // --- Late challenge (last 4–10 days) — elevated urgency with countdown ---
  if (isLate) {
    const peerLine = hasPeers ? `${peerStr} ${peerVerb} completed today's challenge. ` : "";
    const titles = [
      `${daysRemaining} ${daysWord} Left, ${fn}`,
      `Don't Slip Now, ${fn}`,
      `Stay Locked In, ${fn}`,
      `Late-Month Push`,
      `Grind Don't Stop`,
      `${daysRemaining} ${daysWord} to Finish Strong`,
      `Almost Home, ${fn}`,
    ];
    const bodies = [
      `${peerLine}${workLeft} left on Day ${dayNumber}. ${daysRemaining} ${daysWord} to go — hold the line.`,
      `${modNote}${progressNote}. ${daysRemaining} ${daysWord} remaining in ${challengeName} — finish what you started.`,
      `${fn}, ${daysRemaining} ${daysWord} left. ${workLeft} today, then you're one day closer.`,
      `${peerLine}Day ${dayNumber} of ${totalDays}: ${workLeft}. ${daysRemaining} ${daysWord} remaining — let's close strong.`,
      `You've put in the work. ${daysRemaining} ${daysWord} left — finishing today keeps the streak alive. ${workLeft}.`,
      `${daysRemaining} ${daysWord} left in ${challengeName}. ${fn}: ${progressNote}. Stay locked in.`,
      `${peerLine}${workLeft} on Day ${dayNumber}. ${daysRemaining} ${daysWord} to go — don't let up now.`,
    ];
    if (nudge) bodies.push(nudge, `${peerLine}${nudge}`);
    return { title: pick(titles, seed), body: pick(bodies, seed + 1) };
  }

  // --- Time-of-day branches (early in challenge) ---

  if (notificationType === "morning") {
    if (hasPeers) {
      const titles = [
        `Rise & Grind, ${fn}!`,
        `PAX Up, ${fn}`,
        `Get After It, ${fn}`,
        `Morning Accountability`,
        `Don't Sleep, ${fn}`,
        `Early Bird Check-In`,
        `Lead From the Front, ${fn}`,
      ];
      const bodies = [
        `${peerStr} already crushed Day ${dayNumber}. ${workLeft} left for you — get after it.`,
        `${peerStr} ${peerVerb} completed today's challenge. ${fn}, ${workLeft} — start your first set now.`,
        `${peerStr} put in the work. Day ${dayNumber}: ${workLeft} — be next.`,
        `${peerStr} ${peerVerb} completed today's challenge — don't let them show you up. ${workLeft}, ${fn}.`,
        `${peerStr} already done. Day ${dayNumber}: ${progressNote}. Get moving, ${fn}.`,
        `${peerStr} led the way today. ${fn}, ${workLeft} — go now, thank yourself later.`,
        `${peerStr} ${peerVerb} completed today's challenge. ${modNote}${workLeft} — you're next, ${fn}.`,
      ];
      if (nudge) bodies.push(nudge, `${peerStr} ${peerVerb} completed today's challenge. ${nudge}`);
      return { title: pick(titles, seed), body: pick(bodies, seed + 1) };
    } else if (hasPartners) {
      const titles = [
        `Day ${dayNumber} Starts Now`,
        `Rise Up, ${fn}!`,
        `Morning Reps, ${fn}`,
        `PAX Don't Wait`,
        `First Set, ${fn}`,
        `Lead the PAX, ${fn}`,
        `Set the Tone, ${fn}`,
      ];
      const bodies = [
        `${partnerStr} haven't started yet — be the first PAX to finish Day ${dayNumber}.`,
        `${modNote}${progressNote}. Day is young — knock out a set and be the one who leads today.`,
        `${progressNote}. ${fn}, go first — set the tone.`,
        `Nobody's done yet. ${fn}, be the standard — ${workLeft} on Day ${dayNumber}.`,
        `You and ${partnerStr} are all still in it. First one done fires up the rest — go.`,
        `Morning sets pay dividends. ${fn}, ${workLeft} — lead the crew.`,
        `${partnerStr} haven't finished yet. ${fn}: ${progressNote} — lead the charge.`,
      ];
      if (nudge) bodies.push(nudge, `Nobody's done yet — go first. ${nudge}`);
      return { title: pick(titles, seed), body: pick(bodies, seed + 1) };
    } else {
      const titles = [
        `Rise Up, ${fn}!`,
        `Day ${dayNumber}, Let's Go`,
        `Morning Grind, ${fn}`,
        `First Move Wins`,
        `Own the Morning, ${fn}`,
      ];
      const bodies = [
        `Day ${dayNumber} of ${totalDays}: ${workLeft}. Morning sets pay dividends — start now.`,
        `${progressNote}. Day is young, ${fn} — get moving.`,
        `Day ${dayNumber} on ${challengeName}. Be the first PAX to finish today.`,
        `${fn}, ${workLeft} today. Knock your first set out early and thank yourself later.`,
        `${modNote}${workLeft} waiting, ${fn}. Morning is the best time — go.`,
      ];
      if (nudge) bodies.push(nudge);
      return { title: pick(titles, seed), body: pick(bodies, seed + 1) };
    }
  }

  if (notificationType === "afternoon") {
    if (hasPeers) {
      const titles = [
        `Midday Check, ${fn}`,
        `Afternoon Accountability`,
        `Don't Let It Slip, ${fn}`,
        `PAX Rolling, ${fn}`,
        `Halfway Gone, ${fn}`,
        `Clock's Moving, ${fn}`,
        `Get It Done, ${fn}`,
      ];
      const bodies = [
        `${peerStr} ${peerVerb} completed today's challenge. ${fn}: ${progressNote} — do it now, not tonight.`,
        `${peerStr} already done. ${workLeft} on Day ${dayNumber} — don't let it pile up.`,
        `${peerStr} checked in. ${fn}, ${workLeft} — knock a set out before dinner.`,
        `${peerStr} ${peerVerb} completed today's challenge. ${modNote}${progressNote} — you've got time, use it.`,
        `${peerStr} are done for the day. ${fn}: ${workLeft} left, go now.`,
        `${peerStr} already crushed it. Afternoon's the sweet spot — ${workLeft}, ${fn}.`,
        `${peerStr} ${peerVerb} completed today's challenge. ${fn}, don't push it to tonight — ${workLeft} now.`,
      ];
      if (nudge) bodies.push(nudge, `${peerStr} ${peerVerb} completed today's challenge. ${nudge}`);
      return { title: pick(titles, seed), body: pick(bodies, seed + 1) };
    } else if (hasPartners) {
      const titles = [
        `Afternoon Grind, ${fn}`,
        `Midday Push, ${fn}`,
        `Still Time, ${fn}`,
        `Check In, ${fn}`,
        `Beat the Clock, ${fn}`,
      ];
      const bodies = [
        `You and ${partnerStr} are still grinding. ${workLeft} — finish before tonight.`,
        `${partnerStr} haven't finished yet either. Day ${dayNumber}: ${progressNote} — go now.`,
        `You're not alone — ${partnerStr} still have work left too. ${workLeft} to go, ${fn}.`,
        `${groupCompletedCount}/${groupTotalCount} PAX done. ${fn}: ${workLeft} — don't push it to evening.`,
        `${modNote}${partnerStr} still grinding too. ${workLeft} left — who finishes first?`,
      ];
      if (nudge) bodies.push(nudge, `${partnerStr} haven't finished yet either. ${nudge}`);
      return { title: pick(titles, seed), body: pick(bodies, seed + 1) };
    } else {
      const titles = [
        `Midday Check, ${fn}`,
        `Afternoon Accountability`,
        `Use Daylight, ${fn}`,
        `Don't Wait, ${fn}`,
      ];
      const bodies = [
        `${modNote}${progressNote} on Day ${dayNumber}. Afternoon's the sweet spot — knock it out now.`,
        `Day ${dayNumber}: ${workLeft}. Don't let it pile up for tonight.`,
        `${fn}, ${progressNote}. Go now while it's light.`,
        `${modNote}${workLeft} left on Day ${dayNumber}. Afternoons are for grinding — go.`,
      ];
      if (nudge) bodies.push(nudge);
      return { title: pick(titles, seed), body: pick(bodies, seed + 1) };
    }
  }

  // Evening (default)
  if (hasPeers) {
    const titles = [
      `Last Chance, ${fn}`,
      `Clock's Running Out`,
      `PAX Don't Quit`,
      `Evening Accountability`,
      `Don't Sleep on This`,
      `Tonight's the Night, ${fn}`,
      `Finish Day ${dayNumber}, ${fn}`,
    ];
    const bodies = [
      `${peerStr} ${peerVerb} completed today's challenge. ${fn}: ${workLeft} before midnight — let's go.`,
      `${peerStr} already done. Day ${dayNumber} ends soon — ${workLeft}, ${fn}.`,
      `${peerStr} ${peerVerb} completed today's challenge. ${modNote}${progressNote} — last chance to close Day ${dayNumber}.`,
      `${peerStr} checked in. ${fn}, ${progressNote} — do it now.`,
      `${peerStr} are done for the day. ${fn}: clock's running — ${workLeft} left.`,
      `${peerStr} ${peerVerb} completed today's challenge. Don't let Day ${dayNumber} slip — ${workLeft} now.`,
      `${peerStr} put it in. ${fn}, ${workLeft} — don't be the one who didn't finish today.`,
    ];
    if (nudge) bodies.push(nudge, `${peerStr} ${peerVerb} completed today's challenge. ${nudge}`);
    return { title: pick(titles, seed), body: pick(bodies, seed + 1) };
  } else if (hasPartners) {
    const titles = [
      `Last Chance Tonight`,
      `Evening Push, ${fn}`,
      `Don't Break the Streak`,
      `Finish Day ${dayNumber}, ${fn}`,
      `Final Hour, ${fn}`,
    ];
    const bodies = [
      `You and ${partnerStr} still need to finish. ${workLeft} — don't let today slip.`,
      `${partnerStr} are still grinding too. Day ${dayNumber}: ${progressNote}. Finish together.`,
      `Only ${notDoneNames.length + 1} PAX left to finish Day ${dayNumber}. ${fn}, ${workLeft} — go.`,
      `${partnerStr} haven't finished either. ${fn}: ${workLeft} — tonight's your last shot.`,
      `${modNote}${partnerStr} still out there too. ${workLeft}, ${fn} — close it out.`,
    ];
    if (nudge) bodies.push(nudge, `${partnerStr} haven't finished either. ${nudge}`);
    return { title: pick(titles, seed), body: pick(bodies, seed + 1) };
  } else {
    const titles = [
      `Last Chance Tonight`,
      `Clock's Running Out`,
      `Don't Sleep on This`,
      `Finish Strong, ${fn}`,
      `Close It Out, ${fn}`,
    ];
    const bodies = [
      `${fn}, ${workLeft} before midnight. Don't break the streak.`,
      `Day ${dayNumber} ends soon — ${workLeft} left, ${fn}. Get it done.`,
      `Tonight's your last shot on Day ${dayNumber}. ${modNote}${workLeft} — go.`,
      `${fn}: ${progressNote}. Don't let Day ${dayNumber} slip.`,
      `${modNote}${workLeft} between you and Day ${dayNumber}. Close it out, ${fn}.`,
    ];
    if (nudge) bodies.push(nudge);
    return { title: pick(titles, seed), body: pick(bodies, seed + 1) };
  }
}

// ---------------------------------------------------------------------------
// Competitive notifications (opt-in) — rank-based nudges layered onto the
// morning/afternoon/evening reminders. Only sent to PAX who turned them on.
// ---------------------------------------------------------------------------

interface CompetitiveContext {
  rank: number;            // 1-based standing by total reps
  totalParticipants: number;
  userReps: number;
  aheadName?: string;      // nearest PAX strictly ahead
  aheadGap?: number;       // reps needed to pass them
  behindName?: string;     // nearest PAX strictly behind
  behindGap?: number;      // how far back they are
}

/** Rank-based message for a PAX who opted into competitive nudges. Returns null
 *  when there's no one to chase or defend against (caller falls back to the
 *  normal template). */
function generateCompetitiveNotification(ctx: {
  fn: string;
  notificationType: "morning" | "afternoon" | "evening";
  userCompleted: boolean;
  workLeft: string;
  seed: number;
} & CompetitiveContext): { title: string; body: string } | null {
  const {
    fn, notificationType, userCompleted, workLeft, seed,
    rank, totalParticipants, aheadName, aheadGap, behindName, behindGap,
  } = ctx;

  const chase  = aheadName != null && aheadGap != null && aheadGap > 0;
  const defend = behindName != null && behindGap != null && behindGap > 0;
  if (!chase && !defend) return null;

  const repWord = (n: number) => `${n} rep${n === 1 ? "" : "s"}`;
  const todayTail = userCompleted
    ? "You're locked in for today — keep stacking."
    : (workLeft ? `${workLeft} left today — go get it.` : "Get after it.");

  const titlesByType: Record<typeof notificationType, string[]> = {
    morning:   [`Rise & Climb, ${fn} 🏁`, `Morning Standings, ${fn}`, `Chase It Down, ${fn}`, `Move Up Today, ${fn}`],
    afternoon: [`Midday Standings, ${fn}`, `Close the Gap, ${fn} 🏁`, `Move Up, ${fn}`, `Check the Board, ${fn}`],
    evening:   [`Hold Your Spot, ${fn} 🏁`, `Night Standings, ${fn}`, `Last Call on the Board`, `Lock In Your Rank, ${fn}`],
  };

  const bodies: string[] = [];

  if (chase) {
    bodies.push(
      `Only ${repWord(aheadGap!)} until you pass ${aheadName} for #${rank - 1}. ${todayTail}`,
      `You're #${rank} of ${totalParticipants}. ${repWord(aheadGap!)} behind ${aheadName} — take the spot today.`,
      `${aheadName} is right ahead of you — ${repWord(aheadGap!)} and #${rank - 1} is yours, ${fn}.`,
    );
  }

  if (defend) {
    if (rank === 1) {
      bodies.push(
        `You're #1 on the board, ${fn}. ${behindName} is ${repWord(behindGap!)} back — bury the lead deeper. ${todayTail}`,
        `Top of the board and ${behindName} is closing — ${repWord(behindGap!)} back. Don't blink.`,
      );
    } else {
      bodies.push(
        `${behindName} is only ${repWord(behindGap!)} behind you. Defend #${rank}, ${fn}. ${todayTail}`,
        `You're holding #${rank} — ${behindName} is ${repWord(behindGap!)} back. Keep the gap.`,
      );
    }
  }

  if (chase && defend) {
    bodies.push(
      `Sandwiched at #${rank}: ${repWord(aheadGap!)} to pass ${aheadName}, ${behindName} just ${repWord(behindGap!)} behind. ${todayTail}`,
    );
  }

  return { title: pick(titlesByType[notificationType], seed), body: pick(bodies, seed + 1) };
}

// ---------------------------------------------------------------------------
// AI weekly recap — generated by the Next.js app on Vercel (where the OpenAI
// key lives) via POST /api/notifications/recap, auth'd with CRON_SECRET.
//
// ACTIVATION (safe to deploy without — recaps fall back to templates):
//   1. Vercel dashboard: set OPENAI_API_KEY and CRON_SECRET
//   2. firebase functions:secrets:set CRON_SECRET   (same value as Vercel)
//   3. Uncomment defineSecret below and add `secrets: [cronSecret]` to the
//      onSchedule options — deliberately not bound yet because defineSecret
//      makes deploys hard-fail until the secret exists in Secret Manager.
// ---------------------------------------------------------------------------

// const cronSecret = defineSecret("CRON_SECRET");

const APP_URL = process.env.APP_URL ?? "https://f3-bedrock-monthly-challenge.vercel.app";

async function fetchAiRecap(
  userId: string,
  secret: string,
): Promise<{ title: string; body: string } | null> {
  if (!secret) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    const res = await fetch(`${APP_URL}/api/notifications/recap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secret}`,
      },
      body: JSON.stringify({ userId }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`[notify] AI recap HTTP ${res.status} for ${userId}`);
      return null;
    }
    const data = await res.json() as { title?: unknown; body?: unknown };
    if (typeof data.title === "string" && typeof data.body === "string") {
      return { title: data.title, body: data.body };
    }
    return null;
  } catch (err) {
    console.warn(`[notify] AI recap failed for ${userId}:`, err);
    return null;
  }
}

export const sendScheduledNotifications = onSchedule(
  {
    schedule: "*/10 * * * *",
    timeZone: "America/Los_Angeles",
    // secrets: [cronSecret], // ← uncomment on AI recap activation
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
    const dayNumber = getDayNumber(challenge, today)!;
    const totalDays = getTotalDays(challenge);
    const todayTarget = getDailyTarget(challenge, today);
    if (!todayTarget || todayTarget.isRestDay) {
      console.log(`[notify] rest day or no target for ${today}, exiting`);
      return;
    }
    const todayReps = todayTarget.totalReps;
    console.log(`[notify] challenge=${challenge.name} day=${dayNumber}/${totalDays}`);

    const usersSnap = await admin.firestore().collection("users").get();
    const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User & { notificationPreferences: NotifPrefs; currentStreak?: number }));
    console.log(`[notify] ${users.length} users total`);

    // Fetch participation for all users to exclude opted-out PAX from stats
    const participationSnap = await admin.firestore().collection("participation")
      .where("challengeId", "==", challenge.id)
      .get();
    const optedOutIds = new Set(
      participationSnap.docs
        .filter(d => (d.data() as ChallengeParticipation).status === "opted-out")
        .map(d => (d.data() as ChallengeParticipation).userId)
    );
    const activeUsers = users.filter(u => !optedOutIds.has(u.id));
    console.log(`[notify] ${optedOutIds.size} opted-out, ${activeUsers.length} active`);

    // Group completion stats for today (active users only)
    const todayLogsSnap = await admin.firestore().collection("dailyLogs")
      .where("challengeId", "==", challenge.id)
      .where("date", "==", today)
      .get();
    const groupCompleted = todayLogsSnap.docs.filter(d => {
      const log = d.data() as DailyLog;
      return log.completionFraction >= 1 && !optedOutIds.has(log.userId);
    }).length;
    console.log(`[notify] group completion: ${groupCompleted}/${activeUsers.length} done today`);

    // Build name lists for peer pressure messaging (active users only)
    const userById = new Map(users.map(u => [u.id, u.displayName]));
    const completedUserIds = new Set(
      todayLogsSnap.docs
        .filter(d => {
          const log = d.data() as DailyLog;
          return log.completionFraction >= 1 && !optedOutIds.has(log.userId);
        })
        .map(d => (d.data() as DailyLog).userId)
    );
    const allCompletedNames = [...completedUserIds].map(id => userById.get(id) ?? "").filter(Boolean);
    const allNotDoneNames = activeUsers
      .filter(u => !completedUserIds.has(u.id))
      .map(u => u.displayName);
    console.log(`[notify] completed: [${allCompletedNames.join(", ")}] | not done: [${allNotDoneNames.join(", ")}]`);

    // ── Competitive standings (for opted-in PAX) ─────────────────────────────
    // Total reps per active PAX across the whole challenge — matches the reps
    // ranking the leaderboard shows. Only computed once per run and reused.
    const allLogsSnap = await admin.firestore().collection("dailyLogs")
      .where("challengeId", "==", challenge.id)
      .get();
    const repsByUser = new Map<string, number>();
    for (const doc of allLogsSnap.docs) {
      const log = doc.data() as DailyLog;
      if (optedOutIds.has(log.userId)) continue;
      const reps = (log.exerciseLogs ?? []).reduce((s, el) => s + el.completedReps, 0);
      repsByUser.set(log.userId, (repsByUser.get(log.userId) ?? 0) + reps);
    }
    // Ranked descending by reps; ties broken by name for stable ordering.
    const ranked = activeUsers
      .map(u => ({ id: u.id, name: u.displayName, reps: repsByUser.get(u.id) ?? 0 }))
      .sort((a, b) => (b.reps - a.reps) || a.name.localeCompare(b.name));
    const rankByUser = new Map<string, CompetitiveContext>();
    ranked.forEach((entry, i) => {
      // Nearest PAX strictly ahead / behind (skip ties so the gap is real).
      let ahead: { name: string; reps: number } | undefined;
      for (let j = i - 1; j >= 0; j--) {
        if (ranked[j].reps > entry.reps) { ahead = ranked[j]; break; }
      }
      let behind: { name: string; reps: number } | undefined;
      for (let j = i + 1; j < ranked.length; j++) {
        if (ranked[j].reps < entry.reps) { behind = ranked[j]; break; }
      }
      rankByUser.set(entry.id, {
        rank: i + 1,
        totalParticipants: ranked.length,
        userReps: entry.reps,
        aheadName: ahead?.name,
        aheadGap: ahead ? ahead.reps - entry.reps : undefined,
        behindName: behind?.name,
        behindGap: behind ? entry.reps - behind.reps : undefined,
      });
    });

    for (const user of activeUsers) {
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
        if (statusStr === "opted-out") {
          console.log(`[notify]   → opted out, skip`);
          continue;
        }
        if (statusStr === "modifying" && part?.modificationNote) statusStr = `modifying: ${part.modificationNote}`;
        console.log(`[notify]   → participation: ${statusStr}`);

        try {
          const fraction      = userLog?.completionFraction ?? 0;
          // Sum completed reps from exercise logs (rep-type only) for accuracy on mixed-unit challenges.
          // Fall back to fraction × totalReps if logs aren't available yet.
          const repsCompleted = userLog?.exerciseLogs?.length
            ? userLog.exerciseLogs.reduce((sum, el) => {
                const ex = challenge.exercises.find(e => e.id === el.exerciseId);
                return (ex?.unit ?? 'reps') === 'reps' ? sum + Math.min(el.completedReps, el.targetReps) : sum;
              }, 0)
            : Math.round(todayReps * fraction);
          const repsRemaining   = Math.max(0, todayReps - repsCompleted);
          const repsPerExercise = todayTarget.repsPerExercise;

          let { title, body } = generateNotification({
            challenge,
            dailyTarget:         todayTarget,
            exerciseLogs:        userLog?.exerciseLogs ?? null,
            userName:            user.displayName,
            challengeName:       challenge.name,
            dayNumber,
            totalDays,
            todayTarget:         todayReps,
            repsCompleted,
            repsRemaining,
            repsPerExercise,
            primaryExercise:     challenge.exercises[0]?.name ?? "Rep",
            userCompleted,
            completionFraction:  fraction,
            groupCompletedCount: userCompleted ? groupCompleted - 1 : groupCompleted,
            groupTotalCount:     activeUsers.length - 1,
            userStreak:          (user as { currentStreak?: number }).currentStreak ?? 0,
            participationStatus: statusStr,
            notificationType:    w.type,
            completedNames: [...completedUserIds].filter(id => id !== user.id).map(id => userById.get(id) ?? "").filter(Boolean),
            notDoneNames:   activeUsers.filter(u => !completedUserIds.has(u.id) && u.id !== user.id).map(u => u.displayName),
          });

          // Competitive nudges (opt-in): for morning/afternoon/evening, replace
          // the standard nudge with a rank-based one when there's a spot to
          // chase or defend. Weekly recaps keep their own copy.
          if (
            prefs.competitive &&
            (w.type === "morning" || w.type === "afternoon" || w.type === "evening")
          ) {
            const rc = rankByUser.get(user.id);
            if (rc) {
              const comp = generateCompetitiveNotification({
                fn: firstName(user.displayName),
                notificationType: w.type,
                userCompleted,
                workLeft: userCompleted ? "" : `${repsRemaining} reps`,
                seed: notifSeed(dayNumber, `${w.type}_competitive`),
                ...rc,
              });
              if (comp) {
                ({ title, body } = comp);
                console.log(`[notify]   → competitive override applied (rank ${rc.rank}/${rc.totalParticipants})`);
              }
            }
          }

          // Weekly recap: prefer the personalized AI recap from the Vercel
          // app; the template above stays as the fallback.
          if (w.type === "weekly_recap") {
            // Empty until AI recap activation (see comment above fetchAiRecap)
            const secretVal = process.env.CRON_SECRET ?? "";
            const ai = await fetchAiRecap(user.id, secretVal);
            if (ai) ({ title, body } = ai);
            console.log(`[notify]   → recap source: ${ai ? "AI" : "template fallback"}`);
          }
          console.log(`[notify]   → generated: title="${title}" body="${body}"`);

          await sendPushNotification(user.id, user.fcmTokens!, title, body, "/");
          console.log(`[notify]   → FCM sent OK`);

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
// sendTestPush — manual HTTP trigger to test a push notification
// Runs the full notification flow for one user, bypassing the time-window check.
//
// Usage:
//   curl -X POST <url> -H "Content-Type: application/json" \
//     -d '{"userId":"<id>"}'
//
// Optional overrides:
//   -d '{"userId":"<id>","notificationType":"evening"}'   (default: "morning")
//   -d '{"userId":"<id>","title":"Custom","body":"Hi"}'   (skip generation, send directly)
// ---------------------------------------------------------------------------
export const sendTestPush = onRequest(
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

      const dayNumber = getDayNumber(challenge, today)!;
      const totalDays = getTotalDays(challenge);
      const testTarget = getDailyTarget(challenge, today);
      if (!testTarget || testTarget.isRestDay) { res.status(400).json({ error: "Today is a rest day — no notification to send" }); return; }
      const todayReps = testTarget.totalReps;

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
      const completedNames = [...completedIds].filter(id => id !== userId).map(id => userById.get(id) ?? "").filter(Boolean);
      const notDoneNames   = usersSnap.docs.filter(d => d.id !== userId && !completedIds.has(d.id)).map(d => (d.data() as User).displayName);

      const fraction        = userLog?.completionFraction ?? 0;
      const repsCompleted   = userLog?.exerciseLogs?.length
        ? userLog.exerciseLogs.reduce((sum, el) => {
            const ex = challenge.exercises.find(e => e.id === el.exerciseId);
            return (ex?.unit ?? 'reps') === 'reps' ? sum + Math.min(el.completedReps, el.targetReps) : sum;
          }, 0)
        : Math.round(todayReps * fraction);
      const repsRemaining   = Math.max(0, todayReps - repsCompleted);
      const repsPerExercise = testTarget.repsPerExercise;

      const result = generateNotification({
        challenge,
        dailyTarget: testTarget,
        exerciseLogs: userLog?.exerciseLogs ?? null,
        userName: user.displayName, challengeName: challenge.name,
        dayNumber, totalDays, todayTarget: todayReps,
        repsCompleted, repsRemaining, repsPerExercise,
        primaryExercise: challenge.exercises[0]?.name ?? "Rep",
        userCompleted: fraction >= 1,
        completionFraction: fraction,
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

// ---------------------------------------------------------------------------
// badgeBackfill — reusable helper for awarding completion badges after a
// challenge ends. Idempotent: skips users who already have the badge.
// ---------------------------------------------------------------------------

async function runBadgeBackfill(challengeId: string): Promise<Array<{ userId: string; name: string; action: string }>> {
  const challenge = getChallengeById(challengeId);
  if (!challenge) throw new Error(`Unknown challengeId: ${challengeId}`);
  const requiredDays = getRequiredDays(challenge);
  const challengeLabel = challenge.name;
  const db = admin.firestore();

  const usersSnap = await db.collection("users").get();
  const results: Array<{ userId: string; name: string; action: string }> = [];

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    const userId = userDoc.id;
    const name: string = data.displayName ?? userId;

    const badges: Array<{ challengeId: string; type: string }> = data.badges ?? [];
    if (badges.some(b => b.challengeId === challengeId)) {
      results.push({ userId, name, action: "already_has_badge" });
      continue;
    }

    const logsSnap = await db.collection("dailyLogs")
      .where("userId", "==", userId)
      .where("challengeId", "==", challengeId)
      .get();

    const completedDays = logsSnap.docs.filter(
      d => (d.data().completionFraction ?? 0) >= 1
    ).length;

    if (completedDays === 0) {
      results.push({ userId, name, action: "no_logs" });
      continue;
    }

    const isCompleted = completedDays >= requiredDays;
    const badgeType = isCompleted ? "completed" : "participant";

    const filteredBadges = badges.filter(b => b.challengeId !== challengeId);
    await db.doc(`users/${userId}`).update({
      badges: [...filteredBadges, { challengeId, type: badgeType, awardedAt: new Date().toISOString() }],
      pendingCelebration: { challengeId, badgeType },
    });

    const notifId = nanoid();
    const notifTitle = isCompleted ? "🏆 Badge Awarded!" : "💪 Participation Badge Awarded!";
    const notifBody = isCompleted
      ? `You completed ${challengeLabel} — every single day. Your completion badge is now on your profile!`
      : `You put in the work on ${challengeLabel} — ${completedDays} days logged. Your participation badge is on your profile. Make up missed days to earn the completion badge!`;
    await db.doc(`notifications/${userId}/items/${notifId}`).set({
      id: notifId, userId, type: "system", title: notifTitle, body: notifBody,
      read: false, createdAt: new Date().toISOString(),
    });

    const tokens: string[] = data.fcmTokens ?? [];
    if (tokens.length > 0) {
      await sendPushNotification(userId, tokens, notifTitle, notifBody);
    }

    results.push({ userId, name, action: `${badgeType}_badge_awarded (${completedDays} days)` });
  }

  return results;
}

// ---------------------------------------------------------------------------
// backfillAprilBadges — one-time HTTP trigger for April 2026.
// Idempotent. Call once: curl -X POST <function-url>/backfillAprilBadges
// To backfill a future challenge, export a new onRequest that calls
// runBadgeBackfill("<challenge-id>").
// ---------------------------------------------------------------------------

export const backfillAprilBadges = onRequest(async (_req, res) => {
  const results = await runBadgeBackfill("apr-2026");
  res.json({ ok: true, results });
});

// ---------------------------------------------------------------------------
// ensureStorageLifecycle — keeps a 1-year TTL on uploaded feed videos.
//
// Videos are far larger than photos, so we cap how long they live in Storage.
// This sets a GCS Object Lifecycle rule that auto-deletes anything under
// `feed-videos/` 365 days after it's created. Photos (feed-images/) are left
// untouched. The rule is a bucket-level setting, so we reconcile it on a
// schedule (idempotent — setMetadata replaces the lifecycle wholesale) rather
// than trusting a one-time manual `gsutil lifecycle set`.
// ---------------------------------------------------------------------------

const STORAGE_BUCKET = "f3-bedrock-monthly-challenge.firebasestorage.app";
const VIDEO_TTL_DAYS = 365;

export const ensureStorageLifecycle = onSchedule(
  {
    schedule: "0 5 * * 1", // Mondays 05:00 PT
    timeZone: "America/Los_Angeles",
  },
  async () => {
    const bucket = admin.storage().bucket(STORAGE_BUCKET);
    try {
      await bucket.setMetadata({
        lifecycle: {
          rule: [
            {
              action: { type: "Delete" },
              condition: { age: VIDEO_TTL_DAYS, matchesPrefix: ["feed-videos/"] },
            },
          ],
        },
      });
      console.log(`[lifecycle] feed-videos/ TTL set to ${VIDEO_TTL_DAYS} days on ${STORAGE_BUCKET}`);
    } catch (err) {
      // Non-fatal: if the service account can't update bucket metadata, log it
      // so it can be granted storage.buckets.update (or the rule set by hand).
      console.error("[lifecycle] failed to set feed-videos/ lifecycle rule:", err);
    }
  }
);
